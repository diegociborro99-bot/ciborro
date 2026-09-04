import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Buscador general (⌘K / Ctrl+K): apps, fotos, proyectos y acciones en un
 * solo sitio. Coincidencia por subcadena ignorando tildes y mayúsculas, con
 * navegación por teclado y agrupado por tipo.
 */

const fold = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

export default function CommandPalette({ open, onClose, commands }) {
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setI(0)
      // el foco tras la animación de entrada
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open])

  const results = useMemo(() => {
    const needle = fold(q.trim())
    const scored = commands
      .map((c) => {
        if (!needle) return { c, score: c.weight ?? 0 }
        const hay = fold(`${c.label} ${c.sub ?? ''} ${c.keywords ?? ''}`)
        const at = hay.indexOf(needle)
        if (at < 0) return null
        // cuanto antes aparezca la coincidencia, mejor
        return { c, score: 100 - at + (fold(c.label).startsWith(needle) ? 60 : 0) }
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 24)
    return scored.map((s) => s.c)
  }, [q, commands])

  useEffect(() => setI(0), [q])

  useEffect(() => {
    listRef.current?.children[i]?.scrollIntoView({ block: 'nearest' })
  }, [i])

  if (!open) return null

  const run = (cmd) => {
    onClose()
    setTimeout(() => cmd.run(), 0)
  }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setI((n) => Math.min(results.length - 1, n + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setI((n) => Math.max(0, n - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[i]) run(results[i])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      className="fade-in fixed inset-0 z-[9600] flex items-start justify-center px-4 pt-[14vh]"
      style={{ background: 'color-mix(in srgb, var(--bg-deep) 62%, transparent)', backdropFilter: 'blur(6px)' }}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label="Buscar"
        className="pop-in w-full max-w-[560px] overflow-hidden rounded-2xl"
        style={{ background: 'var(--panel)', border: '1px solid var(--line-2)', boxShadow: 'var(--shadow-win)' }}
      >
        <div className="flex items-center gap-3 border-b px-4" style={{ borderColor: 'var(--line)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--tx-3)' }}>
            <circle cx="11" cy="11" r="6.6" stroke="currentColor" strokeWidth="1.5" />
            <path d="m16 16 4.4 4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Buscar fotos, apps, proyectos…"
            aria-label="Buscar"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none focus-visible:outline-none"
            style={{ color: 'var(--tx)' }}
          />
          <kbd
            className="rounded-md px-1.5 py-0.5 text-[10px]"
            style={{ border: '1px solid var(--line-2)', color: 'var(--tx-3)' }}
          >
            esc
          </kbd>
        </div>

        {results.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13.5px]" style={{ color: 'var(--tx-3)' }}>
            Nada con «{q}».
          </p>
        ) : (
          <ul ref={listRef} className="scroll-thin max-h-[46vh] overflow-auto p-1.5">
            {results.map((c, n) => {
              const Icon = c.icon
              const on = n === i
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => run(c)}
                    onMouseMove={() => setI(n)}
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left"
                    style={{ background: on ? 'var(--accent-soft)' : 'transparent' }}
                  >
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                      style={{
                        background: 'var(--panel-2)',
                        border: '1px solid var(--line)',
                        color: on ? 'var(--accent)' : 'var(--tx-2)',
                      }}
                    >
                      {Icon ? <Icon size={16} /> : <Dot />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px]" style={{ color: 'var(--tx)' }}>
                        {c.label}
                      </span>
                      {c.sub && (
                        <span className="block truncate text-[11.5px]" style={{ color: 'var(--tx-3)' }}>
                          {c.sub}
                        </span>
                      )}
                    </span>
                    <span className="label shrink-0">{c.group}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div
          className="flex items-center gap-4 border-t px-4 py-2 text-[10.5px]"
          style={{ borderColor: 'var(--line)', color: 'var(--tx-3)' }}
        >
          <span>↑↓ moverse</span>
          <span>↵ abrir</span>
          <span className="ml-auto">{results.length} resultados</span>
        </div>
      </div>
    </div>
  )
}

const Dot = () => <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
