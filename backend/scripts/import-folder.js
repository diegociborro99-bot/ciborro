import 'dotenv/config'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Sube de golpe una carpeta de fotos al sitio ya desplegado.
 *
 *   ADMIN_PASSWORD=... SITE=https://tu-sitio.up.railway.app \
 *   node scripts/import-folder.js ~/Fotos/seleccion
 *
 * Va de una en una a propósito: convertir un 4K a AVIF consume CPU, y en un
 * contenedor pequeño lanzarlas todas a la vez sólo consigue que se caiga.
 */

const dir = process.argv[2]
const site = (process.env.SITE ?? 'http://localhost:3000').replace(/\/$/, '')
if (!dir) {
  console.error('Uso: node scripts/import-folder.js <carpeta>')
  process.exit(1)
}

const login = await fetch(`${site}/api/admin/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
})
if (!login.ok) {
  console.error('No he podido entrar. ¿ADMIN_PASSWORD correcta?')
  process.exit(1)
}
const cookie = login.headers.get('set-cookie')?.split(';')[0]

const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|tiff?|webp|avif)$/i.test(f)).sort()
console.log(`${files.length} imágenes en ${dir}`)

for (const [i, name] of files.entries()) {
  const buf = await readFile(path.join(dir, name))
  const form = new FormData()
  form.set('title', name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
  form.set('file', new Blob([buf]), name)

  const res = await fetch(`${site}/api/admin/photos`, { method: 'POST', headers: { cookie }, body: form })
  const out = await res.json().catch(() => ({}))
  console.log(
    res.ok
      ? `  [${i + 1}/${files.length}] ${name} → ${out.variants} variantes (${out.width}×${out.height})`
      : `  [${i + 1}/${files.length}] ${name} → ERROR ${out.error ?? res.status}`
  )
}
