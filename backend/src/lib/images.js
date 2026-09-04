import sharp from 'sharp'

/**
 * Cadena de imagen.
 *
 * Entra un original (hasta 4K o más) y salen:
 *   · variantes en AVIF, WebP y JPEG a varios anchos, para que el navegador
 *     elija por `srcset` y nadie se descargue 8 MB para ver una miniatura;
 *   · un LQIP: la misma foto a 24 px en WebP, en base64. Pesa ~400 bytes, va
 *     dentro del JSON y permite enseñar la foto borrosa al instante.
 *
 * AVIF pesa la mitad que JPEG a igual calidad, pero comprime lento; por eso se
 * genera al subir, una vez, y no al vuelo en cada petición.
 */

export const WIDTHS = [400, 800, 1280, 1920, 2560, 3840]
export const FORMATS = [
  { id: 'avif', mime: 'image/avif', opts: { quality: 52, effort: 4 } },
  { id: 'webp', mime: 'image/webp', opts: { quality: 78 } },
  { id: 'jpeg', mime: 'image/jpeg', opts: { quality: 82, mozjpeg: true, progressive: true } },
]

export async function probe(buffer) {
  const m = await sharp(buffer).metadata()
  // una foto girada por EXIF viene con el alto y el ancho al revés
  const swap = m.orientation != null && m.orientation >= 5
  const width = swap ? m.height : m.width
  const height = swap ? m.width : m.height
  return { width, height, ratio: +(height / width).toFixed(4) }
}

/** Miniatura minúscula en base64, para el desenfoque previo. */
export async function makeLqip(buffer) {
  const out = await sharp(buffer)
    .rotate()
    .resize(24, null, { fit: 'inside' })
    .webp({ quality: 42 })
    .toBuffer()
  return `data:image/webp;base64,${out.toString('base64')}`
}

/**
 * Genera todas las variantes. No se agranda nunca: si el original tiene 2000 px
 * no tiene sentido escribir uno de 3840.
 */
export async function makeVariants(buffer, { width }, onEach) {
  const targets = WIDTHS.filter((w) => w <= width)
  if (!targets.length) targets.push(width)

  const made = []
  for (const w of targets) {
    const resized = sharp(buffer).rotate().resize(w, null, { withoutEnlargement: true })
    for (const f of FORMATS) {
      const body = await resized.clone()[f.id](f.opts).toBuffer()
      const v = { width: w, format: f.id, mime: f.mime, body, bytes: body.length }
      made.push(v)
      await onEach?.(v)
    }
  }
  return made
}
