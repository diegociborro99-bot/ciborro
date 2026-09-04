import { useState } from 'react'
import Photo from './Photo'
import { useContent } from '../lib/content'
import { slug } from '../lib/slug'
import { IconNotes } from '../icons/Icons'

/**
 * Lo que hay suelto en el escritorio.
 *
 * Son documentos, no aplicaciones: las apps viven en el dock y repetirlas
 * aquí sólo duplicaba lanzadores. Un clic selecciona, doble clic (o Intro)
 * abre. Se edita en `desktop` dentro de src/data/content.js.
 */
export default function DesktopIcons({ onOpenApp, onOpenPhoto }) {
  const { desktop, photos } = useContent()
  const [sel, setSel] = useState(null)

  const items = desktop
    .map((d, i) => {
      if (d.kind === 'photo') {
        const photo = photos.find((p) => p.id === d.id)
        if (!photo) return null
        return {
          key: `photo-${d.id}`,
          name: `${slug(photo.title)}.jpg`,
          title: photo.title,
          photo,
          run: () => onOpenPhoto(photos.indexOf(photo)),
        }
      }
      return {
        key: `doc-${i}`,
        name: d.name,
        title: d.name,
        run: () => onOpenApp(d.opens),
      }
    })
    .filter(Boolean)

  return (
    <ul
      className="absolute top-[52px] left-4 z-[10] flex w-[96px] flex-col gap-1"
      onPointerDown={(e) => e.target === e.currentTarget && setSel(null)}
    >
      {items.map((it, i) => {
        const on = sel === it.key
        return (
          <li key={it.key}>
            <button
              type="button"
              onClick={() => setSel(it.key)}
              onDoubleClick={it.run}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  it.run()
                }
              }}
              title={`${it.title} — doble clic para abrir`}
              aria-label={`${it.title}, doble clic para abrir`}
              className="animate-in flex w-full flex-col items-center gap-1.5 rounded-lg px-1.5 py-2 transition-colors duration-150"
              style={{ background: on ? 'var(--accent-soft)' : 'transparent', animationDelay: `${300 + i * 55}ms` }}
            >
              <span
                className="grid h-11 w-11 place-items-center overflow-hidden rounded-[10px]"
                style={{
                  background: it.photo ? 'transparent' : 'color-mix(in srgb, var(--panel) 72%, transparent)',
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--line-2)'}`,
                  color: on ? 'var(--accent)' : 'var(--tx)',
                  backdropFilter: it.photo ? 'none' : 'blur(8px)',
                }}
              >
                {it.photo ? (
                  <Photo photo={it.photo} className="h-full w-full" sizes="44px" maxWidth={44} />
                ) : (
                  <IconNotes size={21} />
                )}
              </span>
              <span
                className="w-full truncate rounded px-1 text-center text-[10.5px] leading-tight"
                style={{ color: on ? 'var(--tx)' : 'var(--tx-2)', textShadow: '0 1px 3px var(--halo), 0 0 6px var(--halo)' }}
              >
                {it.name}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
