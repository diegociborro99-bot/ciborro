import 'dotenv/config'
import { readdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { probe, makeLqip, makeVariants } from '../src/lib/images.js'
import { put, removeMany, publicUrl } from '../src/lib/r2.js'

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
 * Entran JPEG, PNG, TIFF, WebP y AVIF. Los RAW (DNG y compañía) NO: no hay
 * revelado aquí, y si se abriera un DNG como TIFF se publicaría la miniatura
 * de 320 px que la cámara guarda en el primer IFD. Revélalos y exporta.
 *
 * El título sale del que pusiste en Lightroom (XMP dc:title, o la
 * descripción EXIF); si no hay, del nombre del archivo. El sitio, de la
 * ciudad del XMP, salvo que lo des con --place. El año, del EXIF.
 *
 * Opciones:
 *   --check            comprueba claves, bucket, URL pública y contraseña, sin fotos
 *   --dry-run          procesa y cuenta, pero ni sube ni registra
 *   --concurrency N    fotos a la vez (por defecto, la mitad de tus núcleos)
 *   --place "Gijón"    sitio para todas las de esta tanda
 *   --year 2025        año para todas (si no, el de la cámara, del EXIF)
 */

const args = process.argv.slice(2)
const opciones = { check: false, dryRun: false, concurrency: null, place: null, year: null }
let dir = null
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--check') opciones.check = true
  else if (a === '--dry-run') opciones.dryRun = true
  else if (a === '--concurrency') opciones.concurrency = Number(args[++i])
  else if (a === '--place') opciones.place = args[++i] ?? ''
  else if (a === '--year') opciones.year = args[++i] ?? ''
  else if (!a.startsWith('--') && !dir) dir = a
}
const dryRun = opciones.dryRun
const concurrency = Math.max(1, opciones.concurrency || Math.max(1, Math.floor(os.cpus().length / 2)))
const placeForAll = opciones.place
const yearForAll = opciones.year

if (!dir && !opciones.check) {
  console.error('Uso: node scripts/publish-photos.js <carpeta> [--dry-run] [--concurrency N] [--place "…"] [--year AAAA]')
  console.error('     node scripts/publish-photos.js --check        (prueba la configuración sin subir fotos)')
  process.exit(1)
}

const site = (process.env.SITE ?? 'http://localhost:3000').replace(/\/$/, '')
const CLAVES = ['ADMIN_PASSWORD', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']
if (!dryRun && !opciones.check) {
  for (const k of CLAVES) {
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

const IMAGEN = /\.(jpe?g|png|tiff?|webp|avif)$/i
const RAW = /\.(dng|rw2|cr2|cr3|nef|nrw|arw|srf|sr2|raf|orf|pef|x3f|3fr|iiq|rwl)$/i

/**
 * Lee una etiqueta de un IFD de TIFF. Es un recorrido mínimo, sin librería:
 * vale para el bloque EXIF de un JPEG (`tiff` es donde empieza la cabecera
 * dentro del bloque) y para un TIFF o DNG entero (`tiff` = 0). Devuelve el
 * texto de una etiqueta ASCII, el valor de una SHORT/LONG, o null.
 */
function tiffTag(buf, tiff, ifd, tag) {
  const le = buf[tiff] === 0x49
  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o))
  const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o))
  if (ifd + 2 > buf.length) return null
  const n = u16(ifd)
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12
    if (e + 12 > buf.length) return null
    if (u16(e) !== tag) continue
    const tipo = u16(e + 2)
    const cuenta = u32(e + 4)
    if (tipo === 4) return u32(e + 8)
    if (tipo === 3) return u16(e + 8)
    if (tipo === 1 || tipo === 2) {
      const off = cuenta <= 4 ? e + 8 : tiff + u32(e + 8)
      const raw = buf.subarray(off, Math.min(off + cuenta, buf.length))
      if (tipo !== 2) return raw.toString('latin1')
      // el EXIF dice ASCII, pero Lightroom escribe UTF-8 y hay cámaras que escriben Latin-1
      let s
      try {
        s = new TextDecoder('utf-8', { fatal: true }).decode(raw)
      } catch {
        s = raw.toString('latin1')
      }
      return s.replace(/\0+$/, '').trim()
    }
    return null
  }
  return null
}

/** Dónde empieza la cabecera TIFF (II*\0 o MM\0*) dentro de un bloque, o -1. */
function tiffStart(buf) {
  const ii = buf.indexOf('II*\0', 0, 'latin1')
  const mm = buf.indexOf('MM\0*', 0, 'latin1')
  const at = ii === -1 ? mm : mm === -1 ? ii : Math.min(ii, mm)
  return at > 16 ? -1 : at
}

function ifd0(buf, tiff) {
  const le = buf[tiff] === 0x49
  return tiff + (le ? buf.readUInt32LE(tiff + 4) : buf.readUInt32BE(tiff + 4))
}

/**
 * El año en que se hizo la foto, leído del EXIF (DateTimeOriginal). Si no
 * está o no se entiende, null, y manda el año actual, como en el panel.
 */
function exifYear(exif) {
  if (!exif || exif.length < 16) return null
  try {
    const tiff = tiffStart(exif)
    if (tiff === -1) return null
    const i0 = ifd0(exif, tiff)
    const exifIfd = tiffTag(exif, tiff, i0, 0x8769)
    const fecha = (typeof exifIfd === 'number' && tiffTag(exif, tiff, tiff + exifIfd, 0x9003)) || tiffTag(exif, tiff, i0, 0x0132)
    const m = typeof fecha === 'string' && fecha.match(/^(\d{4}):/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

/** La descripción EXIF (ImageDescription), que es donde Lightroom pone el pie. */
function exifDescription(exif) {
  if (!exif || exif.length < 16) return null
  try {
    const tiff = tiffStart(exif)
    if (tiff === -1) return null
    const s = tiffTag(exif, tiff, ifd0(exif, tiff), 0x010e)
    return typeof s === 'string' && s ? s : null
  } catch {
    return null
  }
}

/** Un TIFF que en realidad es un DNG: lleva la etiqueta DNGVersion en el IFD0. */
function esDng(buf) {
  try {
    if (buf.length < 16 || tiffStart(buf) !== 0) return false
    return tiffTag(buf, 0, ifd0(buf, 0), 0xc612) != null
  } catch {
    return false
  }
}

const desxml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&amp;/g, '&')
    .trim()

/** Lo que Lightroom escribe en el XMP: título (dc:title) y ciudad (photoshop:City). */
function xmpCampos(xmp) {
  if (!xmp) return {}
  const s = xmp.toString('utf8')
  const title = s.match(/<dc:title>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/)?.[1]
  const city = s.match(/photoshop:City="([^"]*)"/)?.[1] ?? s.match(/<photoshop:City>([\s\S]*?)<\/photoshop:City>/)?.[1]
  return { title: title ? desxml(title) : null, city: city ? desxml(city) : null }
}

/* ── --check: la configuración, sin fotos ───────────────────────────── */

if (opciones.check) {
  let mal = 0
  const ok = (que, detalle = '') => console.log(`  ✓ ${que}${detalle ? ` · ${detalle}` : ''}`)
  const ko = (que, detalle = '') => {
    mal++
    console.log(`  ✗ ${que}${detalle ? ` · ${detalle}` : ''}`)
  }
  console.log(`Comprobando la configuración para ${site}\n`)

  for (const k of CLAVES) process.env[k] ? ok(k) : ko(k, 'falta')
  if (!process.env.R2_PUBLIC_URL) ko('R2_PUBLIC_URL', 'falta: el script no la necesita, pero el servidor sí para montar las URLs')
  else ok('R2_PUBLIC_URL', process.env.R2_PUBLIC_URL)

  if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET) {
    const key = `_comprobacion/${Date.now()}.txt`
    const cuerpo = `comprobación ${new Date().toISOString()}`
    try {
      await put(key, Buffer.from(cuerpo), 'text/plain')
      ok('subir a R2', `${process.env.R2_BUCKET}/${key}`)
      if (process.env.R2_PUBLIC_URL) {
        const url = publicUrl(key)
        try {
          const r = await fetch(url, { cache: 'no-store' })
          const texto = r.ok ? await r.text() : ''
          if (r.ok && texto === cuerpo) ok('leer por la URL pública', url)
          else ko('leer por la URL pública', `${url} → HTTP ${r.status}. ¿Acceso público del bucket activado? ¿R2_PUBLIC_URL es la de ESTE bucket?`)
        } catch (e) {
          ko('leer por la URL pública', `${url} → ${e.cause?.message ?? e.message}`)
        }
      }
      await removeMany([key])
      ok('borrar de R2')
    } catch (e) {
      ko('subir a R2', `${e.name}: ${String(e.message).split('\n')[0]}. ¿Account ID, claves y nombre de bucket correctos? ¿El token tiene permiso Object Read & Write sobre ese bucket?`)
    }
  }

  if (process.env.ADMIN_PASSWORD) {
    try {
      const r = await fetch(`${site}/api/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
      })
      if (!r.ok) ko('entrar en el panel', `${site} → HTTP ${r.status}. ¿ADMIN_PASSWORD es la misma que en Railway? ¿SITE apunta bien?`)
      else {
        ok('entrar en el panel', site)
        const sesion = r.headers.get('set-cookie')?.split(';')[0] ?? ''
        const me = await fetch(`${site}/api/admin/me`, { headers: { cookie: sesion } })
        const { storage, bucket } = me.ok ? await me.json() : {}
        if (storage === 'r2' && bucket === process.env.R2_BUCKET) ok('el servidor usa R2', `bucket ${bucket}`)
        else if (storage === 'r2') ko('el servidor usa R2', `pero su bucket es "${bucket}" y aquí R2_BUCKET es "${process.env.R2_BUCKET}": las fotos irían a uno y el sitio miraría en otro`)
        else if (storage) ko('el servidor usa R2', `está en modo "${storage}": faltan las variables de R2 en Railway (y un redeploy)`)
        else ko('el servidor usa R2', `no he podido preguntárselo (HTTP ${me.status})`)
      }
    } catch (e) {
      ko('entrar en el panel', `${site} → ${e.cause?.message ?? e.message}`)
    }
  }

  console.log(mal ? `\n${mal} cosa${mal > 1 ? 's' : ''} por arreglar.` : '\nTodo en orden. Ya puedes publicar.')
  process.exit(mal ? 1 : 0)
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
    console.error(`No he podido entrar en ${site}. ¿ADMIN_PASSWORD correcta? ¿SITE bien? Prueba con --check.`)
    process.exit(1)
  }
  cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
}

/* ── una foto ───────────────────────────────────────────────────────── */

async function publicar(name) {
  const t0 = performance.now()
  const buf = await readFile(path.join(dir, name))
  if (esDng(buf)) return { name, skip: 'es un DNG con extensión .tif: revélalo y exporta a JPEG' }

  let info
  try {
    info = await probe(buf)
  } catch {
    return { name, skip: 'no parece una imagen' }
  }
  const meta = await sharp(buf).metadata()
  const xmp = xmpCampos(meta.xmp)
  const title = (xmp.title || exifDescription(meta.exif) || name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()).slice(0, 120)
  // el id sale del contenido: la misma foto da el mismo id, y repetir no duplica
  const id = `${slug(title) || 'foto'}-${createHash('sha1').update(buf).digest('hex').slice(0, 6)}`
  const year = yearForAll ?? exifYear(meta.exif) ?? String(new Date().getFullYear())
  const place = (placeForAll ?? xmp.city ?? '').slice(0, 120)

  const lqip = await makeLqip(buf)
  const variants = []
  let bytes = 0
  await makeVariants(buf, info, async (v) => {
    const key = `photos/${id}/${v.width}.${v.format}`
    if (!dryRun) await put(key, v.body, v.mime)
    variants.push({ width: v.width, format: v.format, key, bytes: v.bytes })
    bytes += v.bytes
  })

  const hecho = { name, id, title, place, year, variants: variants.length, bytes, w: info.width, h: info.height, ms: performance.now() - t0 }
  if (dryRun) return hecho

  const res = await fetch(`${site}/api/admin/photos/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ id, title, place, year, ratio: info.ratio, width: info.width, height: info.height, lqip, variants }),
  })
  if (res.status === 409) return { name, id, skip: 'ya estaba' }
  const out = await res.json().catch(() => ({}))
  if (!res.ok) return { name, id, error: out.error ?? `HTTP ${res.status}` }
  return hecho
}

/* ── la carpeta, de N en N ─────────────────────────────────────────── */

const todos = (await readdir(dir)).sort()
const files = todos.filter((f) => IMAGEN.test(f))
const raws = todos.filter((f) => RAW.test(f))
console.log(`${files.length} imágenes en ${dir} · ${concurrency} a la vez${dryRun ? ' · SIMULACIÓN, no se sube nada' : ` · destino ${site}`}`)
if (raws.length) {
  console.log(
    `  ${raws.length} RAW ignorado${raws.length > 1 ? 's' : ''} (${[...new Set(raws.map((f) => path.extname(f).toLowerCase()))].join(', ')}): ` +
      `aquí no hay revelado. Exporta a JPEG desde Lightroom o Capture One y publica esa carpeta.`
  )
}
if (!files.length) process.exit(raws.length ? 1 : 0)

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
        const donde = [r.place, r.year].filter(Boolean).join(', ')
        console.log(`${pre} ${name} → «${r.title}»${donde ? ` (${donde})` : ''} · ${r.w}×${r.h} · ${r.variants} variantes, ${kb(r.bytes)} · ${(r.ms / 1000).toFixed(1)}s`)
      }
    }
  })
)
console.log(`\n${hechas} procesadas en ${((performance.now() - T0) / 1000).toFixed(0)}s · ${kb(subidos)} ${dryRun ? 'que se habrían subido' : 'subidos a R2'}`)
