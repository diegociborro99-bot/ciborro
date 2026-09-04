import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import * as r2 from './r2.js'

/**
 * Dónde viven los archivos de las fotos.
 *
 * Con las claves de R2 puestas, en Cloudflare R2: es lo suyo en producción
 * porque no cobra la salida de datos, que es justo lo que dispara la factura
 * cuando sirves originales de 4K, y los sirve por CDN sin pasar por Node.
 *
 * Sin ellas, en disco, bajo `STORAGE_DIR`, y este proceso los sirve en /fotos.
 * Sirve para desarrollo, y también en Railway si prefieres montar un volumen
 * en vez de abrir cuenta en Cloudflare — pero ojo: sin volumen, el disco del
 * contenedor se borra en cada despliegue y las fotos se van con él.
 */

const here = path.dirname(fileURLToPath(import.meta.url))

export const usingR2 = Boolean(
  process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
)

export const localDir = path.resolve(
  process.env.STORAGE_DIR ?? path.join(here, '../../data/fotos')
)

export const mode = usingR2 ? 'r2' : 'disco'

/** URL pública de un archivo ya guardado. */
export function publicUrl(key) {
  if (usingR2) return r2.publicUrl(key)
  const base = (process.env.PUBLIC_URL ?? '').replace(/\/$/, '')
  return `${base}/fotos/${key}`
}

export async function put(key, body, contentType) {
  if (usingR2) return r2.put(key, body, contentType)
  const dest = path.join(localDir, key)
  await mkdir(path.dirname(dest), { recursive: true })
  await writeFile(dest, body)
  return key
}

export async function removeMany(keys) {
  if (!keys.length) return
  if (usingR2) return r2.removeMany(keys)
  await Promise.all(
    keys.map((k) => rm(path.join(localDir, k), { force: true }).catch(() => {}))
  )
}
