import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Avisos flotantes del sistema. `useToasts()` devuelve la lista y una
 * función `toast(mensaje)`; el componente los pinta arriba a la derecha,
 * bajo la barra de menús, y se van solos.
 */
export function useToasts(ttl = 2600) {
  const [items, setItems] = useState([])
  const seq = useRef(0)

  const toast = useCallback(
    (text, kind = 'info') => {
      const id = ++seq.current
      setItems((xs) => [...xs.slice(-3), { id, text, kind }])
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), ttl)
    },
    [ttl]
  )

  return { items, toast }
}

export default function Toasts({ items }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-[44px] right-3 z-[9300] flex w-[248px] flex-col gap-2"
    >
      {items.map((t) => (
        <Toast key={t.id} t={t} />
      ))}
    </div>
  )
}

function Toast({ t }) {
  const [out, setOut] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setOut(true), 2200)
    return () => clearTimeout(id)
  }, [])

  return (
    <div
      className="toast-in chrome-blur flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12.5px]"
      style={{
        border: '1px solid var(--line-2)',
        boxShadow: 'var(--shadow-pop)',
        color: 'var(--tx)',
        opacity: out ? 0 : 1,
        translate: out ? '0 -6px' : '0 0',
        transition: 'opacity .4s var(--ease), translate .4s var(--ease)',
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: t.kind === 'warn' ? '#d4685c' : 'var(--accent)' }}
      />
      <span className="min-w-0">{t.text}</span>
    </div>
  )
}
