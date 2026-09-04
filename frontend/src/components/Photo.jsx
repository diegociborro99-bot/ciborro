import { useMemo, useState } from 'react'

/**
 * Una foto.
 *
 * Pensado para originales en 4K: nunca se sirve el archivo grande a una
 * miniatura. Si la foto viene de la API trae `sources` con una lista de anchos
 * por formato, y aquí se monta un <picture> con AVIF → WebP → JPEG y su
 * `srcset`/`sizes`; el navegador elige el formato que entiende y el ancho que
 * necesita según su pantalla y su densidad.
 *
 * Mientras carga se ve el `lqip`: la misma foto a 24 px, en base64 dentro del
 * JSON. Aparece al instante, sin una petición extra, y se disuelve cuando
 * entra la buena. El hueco está reservado por `aspect-ratio`, así que no hay
 * saltos de maquetación.
 *
 * Si no hay ni archivo ni variantes, se dibuja un marcador generado por código
 * para que el sitio se vea completo desde el primer día.
 */
export default function Photo({
  photo,
  className = '',
  style,
  sizes = '100vw',
  priority = false,
  eager = false,
  maxWidth,
}) {
  const [loaded, setLoaded] = useState(false)

  const box = {
    background: 'var(--panel-2)',
    ...(photo.lqip
      ? {
          backgroundImage: `url(${photo.lqip})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : null),
    ...style,
  }

  // Con `maxWidth` (una miniatura de 44 px, pongamos) no tiene sentido ofrecer
  // los anchos grandes: se recortan, pero dejando siempre al menos uno para no
  // quedarnos sin candidatos.
  const trim = (list = []) => {
    if (!maxWidth || !list.length) return list
    // hasta el primero que cubra una pantalla del doble de densidad, incluido:
    // así una miniatura sigue viéndose nítida en un portátil retina
    const i = list.findIndex((v) => v.w >= maxWidth * 2)
    return i === -1 ? list : list.slice(0, i + 1)
  }
  const srcset = (list) => trim(list).map((v) => `${v.url} ${v.w}w`).join(', ')
  // el `src` es sólo el respaldo: la versión más pequeña que aún sirva
  const fallbackSrc = (list = []) => (trim(list).at(-1) ?? list.at(-1))?.url

  // foto servida por la API, con todas sus versiones
  if (photo.sources && Object.keys(photo.sources).length) {
    const { avif, webp, jpeg } = photo.sources
    return (
      <div className={`relative overflow-hidden ${className}`} style={box}>
        <picture>
          {avif?.length && <source type="image/avif" srcSet={srcset(avif)} sizes={sizes} />}
          {webp?.length && <source type="image/webp" srcSet={srcset(webp)} sizes={sizes} />}
          <img
            src={fallbackSrc(jpeg) ?? photo.src}
            srcSet={jpeg?.length ? srcset(jpeg) : undefined}
            sizes={sizes}
            alt={photo.title}
            width={photo.width || undefined}
            height={photo.height || undefined}
            loading={priority || eager ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : eager ? 'low' : 'auto'}
            decoding="async"
            onLoad={() => setLoaded(true)}
            className="h-full w-full object-cover"
            style={{
              opacity: loaded ? 1 : 0,
              transition: 'opacity .45s var(--ease)',
            }}
          />
        </picture>
      </div>
    )
  }

  // un solo archivo suelto en public/photos/
  if (photo.src) {
    return (
      <div className={`relative overflow-hidden ${className}`} style={box}>
        {!loaded && !photo.lqip && <div className="skeleton absolute inset-0" />}
        <img
          src={photo.src}
          alt={photo.title}
          loading={priority || eager ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : eager ? 'low' : 'auto'}
          decoding="async"
          sizes={sizes}
          onLoad={() => setLoaded(true)}
          className="h-full w-full object-cover"
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity .45s var(--ease)' }}
        />
      </div>
    )
  }

  return <Procedural photo={photo} className={className} style={style} />
}

/* ── marcador ──────────────────────────────────────────────────────── */

function Procedural({ photo, className = '', style }) {
  const gen = useMemo(() => build(photo), [photo])
  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-label={`Marcador de ${photo.title}`}
        role="img"
      >
        <defs>
          <linearGradient id={`g-${photo.id}`} x1="0" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor={gen.a} />
            <stop offset="100%" stopColor={gen.b} />
          </linearGradient>
          <filter id={`n-${photo.id}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed={gen.seed} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100" height="100" fill={`url(#g-${photo.id})`} />
        {gen.shapes.map((s, i) =>
          s.k === 'c' ? (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={gen.b} opacity={s.o} />
          ) : (
            <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill={gen.a} opacity={s.o} />
          )
        )}
        <rect
          width="100"
          height="100"
          filter={`url(#n-${photo.id})`}
          opacity="0.13"
          style={{ mixBlendMode: 'overlay' }}
        />
      </svg>
    </div>
  )
}

/** Ruido determinista a partir del id — mismo id, misma imagen. */
function build(photo) {
  let h = 2166136261
  for (const ch of photo.id + photo.title) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }

  const [a, b] = photo.placeholder ?? ['#241f19', '#8d7346']
  const shapes = []
  const n = 2 + Math.floor(rnd() * 3)
  for (let i = 0; i < n; i++) {
    if (rnd() > 0.45) {
      shapes.push({ k: 'c', x: rnd() * 100, y: rnd() * 100, r: 12 + rnd() * 38, o: 0.1 + rnd() * 0.24 })
    } else {
      shapes.push({
        k: 'r',
        x: rnd() * 80,
        y: rnd() * 80,
        w: 12 + rnd() * 50,
        h: 8 + rnd() * 60,
        o: 0.1 + rnd() * 0.2,
      })
    }
  }
  return { a, b, shapes, seed: Math.floor(rnd() * 100) }
}
