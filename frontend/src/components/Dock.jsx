import { useEffect, useRef, useState } from 'react'

/** true en pantallas estrechas: el dock se encoge para que quepa entero. */
function useCompact(bp = 640) {
  const [v, setV] = useState(() => window.innerWidth < bp)
  useEffect(() => {
    const on = () => setV(window.innerWidth < bp)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [bp])
  return v
}

/** En pantallas táctiles no hay cursor que seguir: nada de magnificación. */
const isCoarse = () => window.matchMedia('(pointer: coarse)').matches

/**
 * Dock con magnificación por proximidad: la escala de cada icono sale de la
 * distancia horizontal del cursor a su centro, con una caída gaussiana.
 * Ni librería ni sprites — un rAF implícito y CSS.
 *
 * El punto bajo cada icono indica el estado: lleno si la app está abierta,
 * hueco si está minimizada.
 */
export default function Dock({
  items,
  openIds,
  minimizedIds = [],
  activeId,
  onLaunch,
  registerRef,
  extra = null,
}) {
  const ref = useRef(null)
  const [mx, setMx] = useState(null)
  const compact = useCompact()
  const [coarse] = useState(isCoarse)
  const SLOT = compact ? 40 : 46
  const TILE = compact ? 35 : 40

  const scaleFor = (i, total) => {
    if (mx == null || !ref.current) return 1
    const box = ref.current.getBoundingClientRect()
    const step = box.width / total
    const center = box.left + step * (i + 0.5)
    const d = Math.abs(mx - center)
    const spread = 76
    return 1 + 0.44 * Math.exp(-(d * d) / (2 * spread * spread))
  }

  const total = items.length + (extra ? 1 : 0)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[8000] flex justify-center pb-3 sm:pb-4">
      {/*
        El desplazamiento horizontal (para que el dock quepa en móvil) va en
        este envoltorio, no en la barra: un contenedor con overflow recorta por
        los cuatro lados, y los iconos ampliados y sus etiquetas se salen por
        arriba. El hueco de 56 px lo absorbe el margen negativo, así que no
        empuja nada.
      */}
      <div className="scroll-thin pointer-events-auto -mt-14 max-w-[calc(100vw-16px)] overflow-x-auto pt-14">
        <nav
          ref={ref}
          onPointerMove={(e) => !coarse && setMx(e.clientX)}
          onPointerLeave={() => setMx(null)}
          aria-label="Aplicaciones"
          className="chrome-blur flex w-max items-end gap-1 rounded-2xl px-2 py-1.5"
          style={{ border: '1px solid var(--line-2)', boxShadow: '0 14px 44px -12px rgba(0,0,0,.6)' }}
        >
        {items.map((it, i) => {
          const s = scaleFor(i, total)
          const isOpen = openIds.includes(it.id)
          const isMin = minimizedIds.includes(it.id)
          const Icon = it.icon
          return (
            <button
              key={it.id}
              ref={(el) => registerRef?.(it.id, el)}
              type="button"
              onClick={() => onLaunch(it.id)}
              title={it.title}
              aria-label={it.title}
              aria-pressed={isOpen}
              className="group relative flex shrink-0 flex-col items-center"
              style={{ width: SLOT }}
            >
              <span
                className="grid place-items-center rounded-[13px]"
                style={{
                  width: TILE,
                  height: TILE,
                  scale: String(s),
                  translate: `0 ${-(s - 1) * 17}px`,
                  transformOrigin: 'bottom center',
                  transition:
                    mx == null
                      ? 'scale .3s var(--ease-out), translate .3s var(--ease-out), background .2s, border-color .2s'
                      : 'scale .08s linear, translate .08s linear, background .2s, border-color .2s',
                  background: it.id === activeId ? 'var(--accent-soft)' : 'var(--panel-2)',
                  border: `1px solid ${it.id === activeId ? 'var(--accent)' : 'var(--line)'}`,
                  color: it.id === activeId ? 'var(--accent)' : 'var(--tx)',
                }}
              >
                <Icon size={compact ? 18 : 20} />
              </span>

              <span
                className="pointer-events-none absolute -top-9 rounded-md px-2 py-1 text-[11px] whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                style={{ background: 'var(--panel)', border: '1px solid var(--line-2)', color: 'var(--tx)' }}
              >
                {it.title}
              </span>

              <span
                className="mt-1 h-[3.5px] w-[3.5px] rounded-full transition-all duration-200"
                style={{
                  background: isOpen ? 'var(--tx-2)' : 'transparent',
                  border: isMin ? '1px solid var(--tx-3)' : '1px solid transparent',
                  opacity: isOpen || isMin ? 1 : 0,
                }}
              />
            </button>
          )
        })}

        {extra && (
          <>
            <span className="mx-1 mb-3 h-8 w-px shrink-0 self-center" style={{ background: 'var(--line-2)' }} />
            <div className="flex shrink-0 flex-col items-center" style={{ width: SLOT }}>
              <span
                style={{
                  scale: String(scaleFor(total - 1, total)),
                  translate: `0 ${-(scaleFor(total - 1, total) - 1) * 17}px`,
                  transformOrigin: 'bottom center',
                  transition: mx == null ? 'scale .3s var(--ease-out), translate .3s var(--ease-out)' : 'scale .08s linear, translate .08s linear',
                }}
              >
                {extra}
              </span>
              <span className="mt-1 h-[3.5px] w-[3.5px]" />
            </div>
          </>
          )}
        </nav>
      </div>
    </div>
  )
}
