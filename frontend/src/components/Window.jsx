import { useRef } from 'react'
import { usePointerDrag } from '../hooks/usePointerDrag'
import { snapZone } from '../hooks/useWindows'
import { IconClose, IconMinimize, IconMaximize, IconRestore } from '../icons/Icons'

/**
 * Ventana: barra de título arrastrable con anclaje a los bordes, tres
 * controles, y redimensionado por los ocho lados y esquinas.
 *
 * Durante el arrastre la posición se pinta directamente sobre el nodo
 * (sin re-render por fotograma) y sólo se confirma en el estado al soltar.
 */

const EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

const CURSOR = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
}

export default function Window({
  win,
  active,
  onFocus,
  onClose,
  onMinimize,
  onToggleMaximize,
  onGeometry,
  onSnapHint,
  onSnap,
  minimizeTo,
  exposeSlot = null,
  onPick,
  children,
  toolbar = null,
}) {
  const ref = useRef(null)
  const live = useRef({ x: 0, y: 0, w: 0, h: 0 })

  const paint = () => {
    const el = ref.current
    if (!el) return
    const l = live.current
    el.style.translate = `${l.x}px ${l.y}px`
    el.style.width = `${l.w}px`
    el.style.height = `${l.h}px`
  }

  /* — mover — */
  const moveDrag = usePointerDrag({
    onStart: () => {
      onFocus()
      live.current = { x: win.x, y: win.y, w: win.w, h: win.h }
      ref.current?.style.setProperty('transition', 'none')
      return { x: win.x, y: win.y, zone: null }
    },
    onMove: ({ dx, dy, x, y, ctx }) => {
      // arrastrar una ventana maximizada la devuelve a su tamaño
      if (win.maximized) {
        onToggleMaximize()
        return
      }
      live.current.x = ctx.x + dx
      live.current.y = Math.max(2, ctx.y + dy)
      paint()
      const zone = snapZone(x, y)
      if (zone !== ctx.zone) {
        ctx.zone = zone
        onSnapHint?.(zone)
      }
    },
    onEnd: ({ ctx }) => {
      ref.current?.style.removeProperty('transition')
      onSnapHint?.(null)
      if (ctx.zone) onSnap?.(ctx.zone)
      else onGeometry({ x: live.current.x, y: live.current.y })
    },
  })

  /* — redimensionar: se crean siempre los ocho, el orden de hooks es estable — */
  const useEdge = (edge) =>
    usePointerDrag({
      onStart: () => {
        onFocus()
        live.current = { x: win.x, y: win.y, w: win.w, h: win.h }
        ref.current?.style.setProperty('transition', 'none')
        document.body.style.cursor = CURSOR[edge]
        return { x: win.x, y: win.y, w: win.w, h: win.h }
      },
      onMove: ({ dx, dy, ctx }) => {
        const l = live.current
        if (edge.includes('e')) l.w = Math.max(win.minW, ctx.w + dx)
        if (edge.includes('s')) l.h = Math.max(win.minH, ctx.h + dy)
        if (edge.includes('w')) {
          l.w = Math.max(win.minW, ctx.w - dx)
          l.x = ctx.x + (ctx.w - l.w)
        }
        if (edge.includes('n')) {
          l.h = Math.max(win.minH, ctx.h - dy)
          l.y = ctx.y + (ctx.h - l.h)
        }
        paint()
      },
      onEnd: () => {
        document.body.style.cursor = ''
        ref.current?.style.removeProperty('transition')
        onGeometry({ ...live.current })
      },
    })

  const handles = EDGES.map(useEdge)

  if (win.minimized) return null

  // encogerse hacia el icono del dock al minimizar
  /* En la vista general no se cambia el tamaño de la ventana: se la coloca y
     se la escala. Así el contenido no se recompone y al volver queda igual. */
  const exposeStyle = exposeSlot
    ? {
        translate: `${exposeSlot.x}px ${exposeSlot.y}px`,
        scale: String(exposeSlot.scale),
        transformOrigin: 'top left',
        // por encima del telón, que si no se las come
        zIndex: 600 + win.z,
        transition: 'translate .42s var(--ease-out), scale .42s var(--ease-out), box-shadow .3s var(--ease)',
        boxShadow: 'var(--shadow-win)',
      }
    : null

  const shrink = win.minimizing && minimizeTo
  const shrinkStyle = shrink
    ? {
        translate: `${minimizeTo.x - win.w / 2}px ${minimizeTo.y - win.h / 2}px`,
        scale: 0.08,
        opacity: 0,
        transition: 'translate .21s var(--ease), scale .21s var(--ease), opacity .21s var(--ease)',
        pointerEvents: 'none',
      }
    : null

  return (
    <section
      ref={ref}
      role="dialog"
      aria-label={win.title}
      onPointerDown={onFocus}
      className={`fixed top-0 left-0 flex flex-col overflow-hidden rounded-[var(--radius)] ${
        win.closing ? 'win-close' : win.minimizing ? '' : 'win-open'
      }`}
      style={{
        translate: `${win.x}px ${win.y}px`,
        willChange: 'translate',
        width: win.w,
        height: win.h,
        zIndex: win.z,
        background: 'var(--panel)',
        border: `1px solid ${active ? 'var(--line-2)' : 'var(--line)'}`,
        boxShadow: active ? 'var(--shadow-win)' : 'var(--shadow-flat)',
        transition:
          'box-shadow .35s var(--ease), border-color .35s var(--ease), width .2s var(--ease), height .2s var(--ease), translate .2s var(--ease)',
        ...exposeStyle,
        ...shrinkStyle,
      }}
    >
      {/* en la vista general la ventana entera es un botón para elegirla */}
      {exposeSlot && (
        <button
          type="button"
          onClick={onPick}
          aria-label={`Ir a ${win.title}`}
          className="absolute inset-0 z-10 cursor-pointer"
          style={{ background: 'transparent' }}
        />
      )}
      {/* barra de título */}
      <header
        {...moveDrag}
        onDoubleClick={onToggleMaximize}
        className="flex h-9 shrink-0 cursor-grab touch-none items-center gap-3 border-b px-3 select-none active:cursor-grabbing"
        style={{ borderColor: 'var(--line)', background: 'var(--panel-2)' }}
      >
        <div className="flex items-center gap-1.5">
          <TitleButton label="Cerrar" onClick={onClose} tint="#d4685c" Icon={IconClose} />
          <TitleButton label="Minimizar" onClick={onMinimize} tint="#d6ab55" Icon={IconMinimize} />
          <TitleButton
            label={win.maximized ? 'Restaurar' : 'Maximizar'}
            onClick={onToggleMaximize}
            tint="#79ad72"
            Icon={win.maximized ? IconRestore : IconMaximize}
          />
        </div>
        <h2
          className="min-w-0 flex-1 truncate text-center text-[12.5px] font-medium tracking-tight transition-colors duration-300"
          style={{ color: active ? 'var(--tx)' : 'var(--tx-3)' }}
        >
          {win.title}
        </h2>
        <div className="flex w-[54px] shrink-0 justify-end">{toolbar}</div>
      </header>

      <div className="scroll-thin min-h-0 flex-1 overflow-auto">{children}</div>

      {/* asas de redimensionado por los ocho lados */}
      {win.resizable && !win.maximized && (
        <>
          {EDGES.map((edge, i) => (
            <span
              key={edge}
              {...handles[i]}
              aria-hidden="true"
              className="absolute touch-none"
              style={{ ...edgeBox(edge), cursor: CURSOR[edge] }}
            />
          ))}
          <svg
            viewBox="0 0 16 16"
            className="pointer-events-none absolute right-0.5 bottom-0.5 h-3.5 w-3.5 opacity-30"
          >
            <path d="M14 8 8 14M14 12l-2 2" stroke="var(--tx-2)" strokeWidth="1.3" strokeLinecap="round" fill="none" />
          </svg>
        </>
      )}
    </section>
  )
}

/** Zonas sensibles: 6 px en los lados, 14 px en las esquinas. */
function edgeBox(edge) {
  const T = 6
  const C = 14
  switch (edge) {
    case 'n':
      return { top: 0, left: C, right: C, height: T }
    case 's':
      return { bottom: 0, left: C, right: C, height: T }
    case 'e':
      return { right: 0, top: C, bottom: C, width: T }
    case 'w':
      return { left: 0, top: C, bottom: C, width: T }
    case 'ne':
      return { top: 0, right: 0, width: C, height: C }
    case 'nw':
      return { top: 0, left: 0, width: C, height: C }
    case 'se':
      return { bottom: 0, right: 0, width: C, height: C }
    default:
      return { bottom: 0, left: 0, width: C, height: C }
  }
}

function TitleButton({ label, onClick, tint, Icon }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className="group grid h-3.5 w-3.5 place-items-center rounded-full transition-transform duration-200 hover:scale-115"
      style={{ background: tint }}
    >
      <span
        className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        style={{ color: 'rgba(0,0,0,.62)' }}
      >
        <Icon size={9} strokeWidth={2.6} />
      </span>
    </button>
  )
}
