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

/**
 * Quieto: sin cursor que seguir (táctil) o con movimiento reducido pedido.
 * En ese caso la magnificación no se calcula siquiera — y como era la única
 * afordancia de puntero que tenía el dock, los estados de hover y foco viven
 * en CSS (.dock-slot en index.css) y no dependen de esto.
 */
const isStill = () =>
  window.matchMedia('(pointer: coarse)').matches ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Dock con magnificación por proximidad: la escala de cada icono sale de la
 * distancia horizontal del cursor a su centro, con una caída gaussiana.
 * Ni librería ni sprites — un rAF implícito y CSS.
 *
 * Los centros se miden de los nodos, no se deducen de un reparto uniforme: hay
 * huecos, relleno y un separador, así que la cuenta teórica se desviaba hasta
 * 15 px en el último icono y la joroba no caía bajo el cursor.
 *
 * El punto bajo cada icono dice el estado: ámbar la que tienes delante, clara
 * las demás abiertas, apagada la que está minimizada.
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
  const slots = useRef([])
  const [mx, setMx] = useState(null)
  const compact = useCompact()
  const [still] = useState(isStill)
  const SLOT = compact ? 36 : 46
  const TILE = compact ? 32 : 40

  /* Amplitud y anchura calibradas para que el pico quepa sin agrandar el dock:
     con paso real de 50 px y ficha de 40, el icono ampliado mide 52 y su vecino
     47,6 — se rozan y no se montan, que es lo que pasaba antes. El levantamiento
     compensa la amplitud más baja para conservar el mismo salto de 7,5 px. */
  const scaleFor = (i) => {
    const el = slots.current[i]
    if (mx == null || still || compact || !el) return 1
    const box = el.getBoundingClientRect()
    const d = Math.abs(mx - (box.left + box.width / 2))
    const spread = 52
    return 1 + 0.3 * Math.exp(-(d * d) / (2 * spread * spread))
  }

  const extraScale = scaleFor(items.length)
  const lift = (s) => `0 ${-(s - 1) * 25}px`
  const ease = (extraProps = '') =>
    (mx == null
      ? 'scale .3s var(--ease-out), translate .3s var(--ease-out)'
      : 'scale .08s linear, translate .08s linear') + extraProps

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
          onPointerMove={(e) => !still && !compact && setMx(e.clientX)}
          onPointerLeave={() => setMx(null)}
          aria-label="Aplicaciones"
          className="chrome-blur flex w-max items-end gap-0.5 rounded-2xl px-2 py-1.5 sm:gap-1"
          style={{ border: '1px solid var(--line-2)', boxShadow: 'var(--shadow-pop)' }}
        >
          {items.map((it, i) => {
            const s = scaleFor(i)
            const isOpen = openIds.includes(it.id)
            const isMin = minimizedIds.includes(it.id)
            const isActive = it.id === activeId
            const Icon = it.icon
            return (
              <button
                key={it.id}
                ref={(el) => {
                  slots.current[i] = el
                  registerRef?.(it.id, el)
                }}
                type="button"
                onClick={() => onLaunch(it.id)}
                aria-label={isMin ? `${it.title} (minimizada)` : it.title}
                aria-pressed={isOpen}
                data-active={isActive ? '' : undefined}
                className="dock-slot group relative flex shrink-0 flex-col items-center"
                style={{ width: SLOT }}
              >
                <span
                  className="dock-tile grid place-items-center rounded-[13px]"
                  style={{
                    width: TILE,
                    height: TILE,
                    scale: String(s),
                    translate: lift(s),
                    transformOrigin: 'bottom center',
                    transition: ease(', background .2s, border-color .2s, color .2s'),
                  }}
                >
                  <Icon size={compact ? 18 : 20} />
                </span>

                {/* la etiqueta sube con la ficha: si no, la ampliada la tapa */}
                <span
                  className="pointer-events-none absolute rounded-md px-2 py-1 text-[11px] whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                  style={{
                    top: -(30 + (s - 1) * (TILE + 25)),
                    background: 'var(--panel)',
                    border: '1px solid var(--line-2)',
                    color: 'var(--tx)',
                  }}
                >
                  {it.title}
                </span>

                <span
                  className="mt-1 h-1 w-1 rounded-full transition-all duration-200"
                  style={{
                    background: isActive ? 'var(--accent)' : isMin ? 'var(--tx-3)' : 'var(--tx-2)',
                    opacity: isOpen || isMin ? 1 : 0,
                  }}
                />
              </button>
            )
          })}

          {extra && (
            <>
              <span
                className="mx-0.5 mb-3 h-8 w-px shrink-0 self-center sm:mx-1"
                style={{ background: 'var(--line-2)' }}
              />
              <div className="flex shrink-0 flex-col items-center" style={{ width: SLOT }}>
                <span
                  ref={(el) => (slots.current[items.length] = el)}
                  style={{
                    scale: String(extraScale),
                    translate: lift(extraScale),
                    transformOrigin: 'bottom center',
                    transition: ease(),
                  }}
                >
                  {extra}
                </span>
                {/* mismo alto que el punto, o el botón de buscar se desalinea */}
                <span className="mt-1 h-1 w-1" />
              </div>
            </>
          )}
        </nav>
      </div>
    </div>
  )
}
