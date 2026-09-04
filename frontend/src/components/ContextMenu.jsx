import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Menú contextual del escritorio (botón derecho). Se coloca solo para no
 * salirse de la pantalla y se cierra con Esc, con un clic fuera o al elegir.
 */
export default function ContextMenu({ at, items, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(at)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      x: Math.min(at.x, window.innerWidth - r.width - 10),
      y: Math.min(at.y, window.innerHeight - r.height - 10),
    })
  }, [at])

  useEffect(() => {
    const away = (e) => !ref.current?.contains(e.target) && onClose()
    const esc = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      className="pop-in fixed z-[9200] w-56 rounded-xl p-1.5"
      style={{
        left: pos.x,
        top: pos.y,
        background: 'var(--panel)',
        border: '1px solid var(--line-2)',
        boxShadow: 'var(--shadow-pop)',
      }}
    >
      {items.map((it, i) =>
        it.sep ? (
          <div key={i} className="my-1.5 h-px" style={{ background: 'var(--line)' }} />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            onClick={() => {
              it.action?.()
              onClose()
            }}
            className="flex w-full items-center justify-between gap-4 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors duration-150"
            style={{ color: 'var(--tx)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-soft)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {it.label}
            {it.hint && (
              <kbd className="text-[10.5px]" style={{ color: 'var(--tx-3)' }}>
                {it.hint}
              </kbd>
            )}
          </button>
        )
      )}
    </div>
  )
}
