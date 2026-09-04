import { useEffect, useMemo, useRef, useState } from 'react'
import { useContent } from '../lib/content'

/**
 * Reloj mundial. Muestra una zona a la vez; al hacer clic pasa a la
 * siguiente y despliega el resto con una carátula analógica pequeña.
 * Sin dependencias: Intl.DateTimeFormat hace todo el trabajo de zonas.
 */
export default function WorldClock() {
  const { clocks } = useContent()
  const [now, setNow] = useState(() => new Date())
  const [i, setI] = useState(0)
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  // sincroniza el tick con el segundo del reloj del sistema
  useEffect(() => {
    let id
    const tick = () => {
      const d = new Date()
      setNow(d)
      id = setTimeout(tick, 1000 - (d.getMilliseconds() % 1000))
    }
    tick()
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!open) return
    const away = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  const active = clocks[i % clocks.length]

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onContextMenu={(e) => {
          e.preventDefault()
          setI((n) => n + 1)
        }}
        title="Relojes del mundo"
        className="flex items-center gap-2 rounded-md px-2 py-1 text-[12px] transition-colors duration-200"
        style={{ color: 'var(--tx)' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--line)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <Dial date={now} tz={active.tz} size={13} />
        <span className="hidden sm:inline" style={{ color: 'var(--tx-2)' }}>
          {active.label}
        </span>
        <span className="tnum font-medium">{fmt(now, active.tz)}</span>
      </button>

      {open && (
        <div
          className="animate-in absolute right-0 mt-1.5 w-60 overflow-hidden rounded-xl p-1.5"
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--line-2)',
            boxShadow: 'var(--shadow-win)',
          }}
        >
          <p className="label px-2.5 pt-1.5 pb-2">Relojes</p>
          {clocks.map((c, n) => (
            <button
              key={c.tz}
              type="button"
              onClick={() => {
                setI(n)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150"
              style={{ background: n === i % clocks.length ? 'var(--accent-soft)' : 'transparent' }}
              onMouseEnter={(e) => {
                if (n !== i % clocks.length) e.currentTarget.style.background = 'var(--line)'
              }}
              onMouseLeave={(e) => {
                if (n !== i % clocks.length) e.currentTarget.style.background = 'transparent'
              }}
            >
              <Dial date={now} tz={c.tz} size={17} />
              <span className="flex-1 text-[13px]" style={{ color: 'var(--tx)' }}>
                {c.label}
              </span>
              <span className="tnum text-[13px]" style={{ color: 'var(--tx-2)' }}>
                {fmt(now, c.tz)}
              </span>
              <span className="tnum w-8 text-right text-[10px]" style={{ color: 'var(--tx-3)' }}>
                {offsetLabel(now, c.tz)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Carátula analógica minúscula: dos agujas y un punto. */
function Dial({ date, tz, size }) {
  const { h, m } = useMemo(() => parts(date, tz), [date, tz])
  const mAng = m * 6
  const hAng = ((h % 12) + m / 60) * 30
  const r = size / 2
  const night = h < 7 || h >= 20

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <circle
        cx="12"
        cy="12"
        r="10.6"
        fill={night ? 'var(--line)' : 'none'}
        stroke="var(--tx-3)"
        strokeWidth="1.5"
      />
      <g stroke={night ? 'var(--tx-2)' : 'var(--accent)'} strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="12" x2="12" y2="6.6" transform={`rotate(${hAng} 12 12)`} />
      </g>
      <line
        x1="12"
        y1="12"
        x2="12"
        y2="4.4"
        stroke="var(--tx)"
        strokeWidth="1.5"
        strokeLinecap="round"
        transform={`rotate(${mAng} 12 12)`}
      />
      <circle cx="12" cy="12" r={r > 8 ? 1.1 : 0.9} fill="var(--tx)" />
    </svg>
  )
}

function parts(date, tz) {
  const f = new Intl.DateTimeFormat('es-ES', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (t) => Number(f.find((p) => p.type === t)?.value ?? 0)
  return { h: get('hour') % 24, m: get('minute') }
}

function fmt(date, tz) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

/** Diferencia en horas respecto a la zona local, como "+9" o "−6". */
function offsetLabel(date, tz) {
  const local = new Date(date.toLocaleString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }))
  const there = new Date(date.toLocaleString('en-US', { timeZone: tz }))
  const diff = Math.round((there - local) / 3600000)
  if (diff === 0) return 'aquí'
  return `${diff > 0 ? '+' : '−'}${Math.abs(diff)} h`
}
