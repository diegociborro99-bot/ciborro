import 'dotenv/config'
import { readdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { probe, makeLqip, makeVariants } from '../src/lib/images.js'
import { put } from '../src/lib/r2.js'

/**
 * Publica una carpeta de fotos haciendo el trabajo pesado AQUÍ, en tu
 * ordenador, y no en el servidor.
 *
 *   ADMIN_PASSWORD=… SITE=https://www.ciborro.es \
 *   node scripts/publish-photos.js ~/Fotos/seleccion
 *
 * De cada original salen las mismas 18 variantes y el mismo LQIP que si la
 * subieras por el panel —es la misma cadena de imagen, src/lib/images.js—,
 * pero se calculan con tu CPU, se suben directas a R2 y al servidor sólo le
 * llega un JSON diciendo qué hay. Un 4K que en el contenedor tarda 5-10 s
 * aquí tarda uno, no hay tope de tamaño, y es imposible tumbar el servidor.
 *
 * Necesita en el entorno (o en backend/.env) las claves de R2 y la
 * contraseña del panel. Es idempotente: el id sale del contenido, así que
 * volver a lanzarlo sobre la misma carpeta salta las que ya están.
 *
 * Opciones:
 *   --dry-run          procesa y cuenta, pero ni sube ni registra
 *   --concurrency N    fotos a la vez (por defecto, la mitad de tus núcleos)
 *   --place "Gijón"    sitio para todas las de esta tanda
 *   --year 2025        año para todas (si no, el de la cámara, del EXIF)
 */

const args = process.argv.slice(2)
const opciones = { dryRun: false, concurrency: null, place: null, year: null }
let dir = null
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--dry-run') opciones.dryRun = true
  else if (a === '--concurrency') opciones.concurrency = Number(args[++i])
  else if (a === '--place') opciones.place = args[++i] ?? ''
  else if (a === '--year') opciones.year = args[++i] ?? ''
  else if (!a.startsWith('--') && !dir) dir = a
}
const dryRun = opciones.dryRun
const concurrency = Math.max(1, opciones.concurrency || Math.max(1, Math.floor(os.cpus().length / 2)))
const placeForAll = opciones.place
const yearForAll = opciones.year

if (!dir) {
  console.error('Uso: node scripts/publish-photos.js <carpeta> [--dry-run] [--concurrency N] [--place "…"] [--year AAAA]')
  process.exit(1)
}

const site = (process.env.SITE ?? 'http://localhost:3000').replace(/\/$/, '')
if (!dryRun) {
  for (const k of ['ADMIN_PASSWORD', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']) {
    if (!process.env[k]) {
      console.error(`Falta ${k}. Ponla en el entorno o en backend/.env (o usa --dry-run para probar sin subir).`)
      process.exit(1)
    }
  }
}

/* ── utilidades ─────────────────────────────────────────────────────── */

const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)

const kb = (n) => `${Math.round(n / 1024)} KB`

/**
 * El año en que se hizo la foto, leído del EXIF (DateTimeOriginal). Es un
 * recorrido mínimo de los IFD de TIFF: no hace falta una librería para leer
 * una etiqueta. Si no está o no se entiende, se devuelve null y manda el
 * año actual, como en el panel.
 */
function exifYear(exif) {
  if (!exif || exif.length < 16) return null
  const tiff = exif.indexOf('II*\0', 0, 'latin1') !== -1 ? exif.indexOf('II*\0', 0, 'latin1') : exif.indexOf('MM\0*', 0, 'latin1')
  if (tiff === -1 || tiff > 16) return null
  const le = exif[tiff] === 0x49
  const u16 = (o) => (le ? exif.readUInt16LE(o) : exif.readUInt16BE(o))
  const u32 = (o) => (le ? exif.readUInt32LE(o) : exif.readUInt32BE(o))
  const leer = (ifd, tag) => {
    if (ifd + 2 > exif.length) return null
    const n = u16(ifd)
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12
      if (e + 12 > exif.length) return null
      if (u16(e) !== tag) continue
      const tipo = u16(e + 2)
      const cuenta = u32(e + 4)
      if (tipo === 4 || tipo === 3) return u32(e + 8) // LONG/SHORT: el valor va inline
      if (tipo === 2) {
        const off = cuenta <= 4 ? e + 8 : tiff + u32(e + 8)
        return exif.toString('latin1', off, Math.min(off + cuenta, exif.length))
      }
      return null
    }
    return null
  }
  try {
    const ifd0 = tiff + u32(tiff + 4)
    const exifIfd = leer(ifd0, 0x8769)
    const fecha = (exifIfd != null && leer(tiff + exifIfd, 0x9003)) || leer(ifd0, 0x0132)
    const m = typeof fecha === 'string' && fecha.match(/^(\d{4}):/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

/* ── sesión ─────────────────────────────────────────────────────────── */

let cookie = ''
if (!dryRun) {
  const login = await fetch(`${site}/api/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
  })
  if (!login.ok) {
    console.error(`No he podido entrar en ${site}. ¿ADMIN_PASSWORD correcta? ¿SITE bien?`)
    process.exit(1)
  }
  cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
}

/* ── una foto ───────────────────────────────────────────────────────── */

async function publicar(name) {
  const t0 = performance.now()
  const buf = await readFile(path.join(dir, name))
  const title = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
  // el id sale del contenido: la misma foto da el mismo id, y repetir no duplica
  const id = `${slug(title) || 'foto'}-${createHash('sha1').update(buf).digest('hex').slice(0, 6)}`

  let info
  try {
    info = await probe(buf)
  } catch {
    return { name, skip: 'no parece una imagen' }
  }
  const meta = await sharp(buf).metadata()
  const year = yearForAll ?? exifYear(meta.exif) ?? String(new Date().getFullYear())
  const place = placeForAll ?? ''

  const lqip = await makeLqip(buf)
  const variants = []
  let bytes = 0
  await makeVariants(buf, info, async (v) => {
    const key = `photos/${id}/${v.width}.${v.format}`
    if (!dryRun) await put(key, v.body, v.mime)
    variants.push({ width: v.width, format: v.format, key, bytes: v.bytes })
    bytes += v.bytes
  })

  if (dryRun) return { name, id, year, variants: variants.length, bytes, w: info.width, h: info.height, ms: performance.now() - t0 }

  const res = await fetch(`${site}/api/admin/photos/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ id, title, place, year, ratio: info.ratio, width: info.width, height: info.height, lqip, variants }),
  })
  if (res.status === 409) return { name, id, skip: 'ya estaba' }
  const out = await res.json().catch(() => ({}))
  if (!res.ok) return { name, id, error: out.error ?? `HTTP ${res.status}` }
  return { name, id, year, variants: variants.length, bytes, w: info.width, h: info.height, ms: performance.now() - t0 }
}

/* ── la carpeta, de N en N ─────────────────────────────────────────── */

const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|tiff?|webp|avif)$/i.test(f)).sort()
console.log(`${files.length} imágenes en ${dir} · ${concurrency} a la vez${dryRun ? ' · SIMULACIÓN, no se sube nada' : ` · destino ${site}`}`)

let hechas = 0
let subidos = 0
const cola = [...files]
const T0 = performance.now()
await Promise.all(
  Array.from({ length: Math.min(concurrency, cola.length) }, async () => {
    while (cola.length) {
      const name = cola.shift()
      let r
      try {
        r = await publicar(name)
      } catch (e) {
        r = { name, error: e.message }
      }
      hechas++
      const pre = `  [${String(hechas).padStart(String(files.length).length)}/${files.length}]`
      if (r.skip) console.log(`${pre} ${name} → ${r.skip}`)
      else if (r.error) console.log(`${pre} ${name} → ERROR ${r.error}`)
      else {
        subidos += r.bytes
        console.log(`${pre} ${name} → ${r.id} · ${r.w}×${r.h} · ${r.year} · ${r.variants} variantes, ${kb(r.bytes)} · ${(r.ms / 1000).toFixed(1)}s`)
      }
    }
  })
)
console.log(`\n${hechas} procesadas en ${((performance.now() - T0) / 1000).toFixed(0)}s · ${kb(subidos)} ${dryRun ? 'que se habrían subido' : 'subidos a R2'}`)
