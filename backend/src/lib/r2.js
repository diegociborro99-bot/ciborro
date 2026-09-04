import { S3Client, PutObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'

/**
 * Cloudflare R2.
 *
 * Es S3 por dentro, así que vale el SDK de AWS apuntando al endpoint de R2.
 * Lo importante para un portfolio de fotos: R2 no cobra la salida de datos,
 * que es justo lo que dispara la factura al servir originales en 4K.
 *
 * Los objetos se sirven por la URL pública del bucket (R2_PUBLIC_URL), no por
 * este proceso: Node no debe tocar los bytes de una foto nunca más después de
 * subirla.
 */

const need = (k) => {
  const v = process.env[k]
  if (!v) throw new Error(`Falta la variable ${k}`)
  return v
}

let client

export function r2() {
  client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${need('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: need('R2_ACCESS_KEY_ID'),
      secretAccessKey: need('R2_SECRET_ACCESS_KEY'),
    },
  })
  return client
}

export const bucket = () => need('R2_BUCKET')

/** URL pública de un objeto. Pon un dominio propio en R2_PUBLIC_URL y va por CDN. */
export const publicUrl = (key) => `${need('R2_PUBLIC_URL').replace(/\/$/, '')}/${key}`

export async function put(key, body, contentType) {
  await r2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      // inmutable: cada variante lleva el ancho y el formato en la ruta, así que
      // si cambia el contenido cambia la ruta. Un año de caché sin miedo.
      CacheControl: 'public, max-age=31536000, immutable',
    })
  )
  return key
}

export async function removeMany(keys) {
  if (!keys.length) return
  // DeleteObjects acepta 1000 por llamada
  for (let i = 0; i < keys.length; i += 1000) {
    await r2().send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) },
      })
    )
  }
}
