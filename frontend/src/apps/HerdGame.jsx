import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Pastorea a los gatos.
 *
 * La gracia no es perseguirlos: es que se comportan como una manada. Cada gato
 * huye del cursor, se separa de sus vecinos, tiende a seguirlos y a agruparse
 * con ellos, y esquiva los muebles. Empujando por el lado bueno se mueven
 * juntos; persiguiéndolos se desparraman.
 *
 * Y son gatos: una vez dentro de la alfombra se acomodan, pero al rato se
 * aburren y se van. Hay que meterlos a todos y que aguanten juntos.
 *
 * Física, IA, rondas y dibujo escritos aquí. Sin librerías.
 */

const R = 11 // radio del gato
const FLEE = 96 // hasta dónde asusta el cursor
const HOLD = 1.6 // s que tienen que aguantar todos dentro
const BORED = 4.2 // s acomodado antes de aburrirse y salir
const MAX_V = 215
const STORE = 'herd-best'

const catsFor = (round) => 3 + round
const obstaclesFor = (round) => (round < 2 ? 0 : round < 4 ? 1 : 2)

export default function HerdGame() {
  const boxRef = useRef(null)
  const cats = useRef([])
  const walls = useRef([])
  const pen = useRef({ x: 0, y: 0, w: 0, h: 0 })
  const mouse = useRef({ x: -999, y: -999, on: false })
  const hold = useRef(0)

  const [round, setRound] = useState(1)
  const [status, setStatus] = useState('idle') // idle | playing | won
  const [time, setTime] = useState(0)
  const [inside, setInside] = useState(0)
  const [best, setBest] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORE) ?? '{}')
    } catch {
      return {}
    }
  })
  const [, force] = useState(0)

  /* — colocación del tablero — */
  const layout = useCallback(() => {
    const el = boxRef.current
    if (!el) return
    const b = el.getBoundingClientRect()
    const pw = Math.max(120, Math.min(170, b.width * 0.34))
    const ph = Math.max(100, Math.min(140, b.height * 0.36))
    pen.current = { x: b.width - pw - 18, y: b.height - ph - 18, w: pw, h: ph }
  }, [])

  useEffect(() => {
    layout()
    const ro = new ResizeObserver(layout)
    if (boxRef.current) ro.observe(boxRef.current)
    return () => ro.disconnect()
  }, [layout])

  const start = useCallback(
    (n) => {
      const el = boxRef.current
      if (!el) return
      layout()
      const b = el.getBoundingClientRect()

      // muebles: círculos fijos lejos de la alfombra
      walls.current = Array.from({ length: obstaclesFor(n) }, (_, i) => ({
        x: b.width * (i === 0 ? 0.42 : 0.24),
        y: b.height * (i === 0 ? 0.34 : 0.72),
        r: 26 + i * 6,
      }))

      cats.current = Array.from({ length: catsFor(n) }, (_, i) => ({
        id: i,
        x: 26 + Math.random() * Math.max(50, b.width * 0.42),
        y: 26 + Math.random() * Math.max(50, b.height * 0.55),
        vx: 0,
        vy: 0,
        wander: Math.random() * Math.PI * 2,
        flip: false,
        calm: 0,
        scare: 0,
      }))

      hold.current = 0
      setTime(0)
      setInside(0)
      setRound(n)
      setStatus('playing')
    },
    [layout]
  )

  /* — bucle — */
  useEffect(() => {
    if (status !== 'playing') return
    let raf
    let last = performance.now()

    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 0.04)
      last = now
      const el = boxRef.current
      if (!el) return
      const b = el.getBoundingClientRect()
      const p = pen.current
      const list = cats.current

      // centro de la manada, para la cohesión
      let cx = 0
      let cy = 0
      for (const c of list) {
        cx += c.x
        cy += c.y
      }
      cx /= list.length
      cy /= list.length

      for (const c of list) {
        const inPen = c.x > p.x && c.x < p.x + p.w && c.y > p.y && c.y < p.y + p.h

        // — miedo al cursor —
        const dx = c.x - mouse.current.x
        const dy = c.y - mouse.current.y
        const d = Math.hypot(dx, dy)
        const scared = mouse.current.on && d < FLEE
        c.scare = scared ? 1 : Math.max(0, c.scare - dt * 2)

        if (scared && d > 0.001) {
          const push = (1 - d / FLEE) ** 2 * 1150
          c.vx += (dx / d) * push * dt
          c.vy += (dy / d) * push * dt
          c.calm = 0
        }

        // — acomodarse dentro de la alfombra, y aburrirse —
        if (inPen && !scared) {
          c.calm += dt
          if (c.calm > BORED) {
            // se levanta y se va, que para eso es un gato
            const ox = c.x - (p.x + p.w / 2)
            const oy = c.y - (p.y + p.h / 2)
            const on = Math.hypot(ox, oy) || 1
            c.vx += (ox / on) * 62 * dt
            c.vy += (oy / on) * 62 * dt
          }
        } else if (!inPen) {
          c.calm = 0
        }

        const settled = inPen && c.calm > 0.5 && c.calm < BORED

        if (!settled) {
          // — deambular —
          c.wander += (Math.random() - 0.5) * 2.6 * dt
          c.vx += Math.cos(c.wander) * 30 * dt
          c.vy += Math.sin(c.wander) * 30 * dt

          // — manada: separación fuerte, alineación y cohesión suaves —
          let ax = 0
          let ay = 0
          let n = 0
          for (const o of list) {
            if (o === c) continue
            const ox = c.x - o.x
            const oy = c.y - o.y
            const od = Math.hypot(ox, oy)
            if (od < R * 2.6 && od > 0.001) {
              c.vx += (ox / od) * 190 * dt
              c.vy += (oy / od) * 190 * dt
            }
            if (od < 110) {
              ax += o.vx
              ay += o.vy
              n++
            }
          }
          if (n) {
            c.vx += (ax / n - c.vx) * 0.9 * dt
            c.vy += (ay / n - c.vy) * 0.9 * dt
          }
          c.vx += (cx - c.x) * 0.22 * dt
          c.vy += (cy - c.y) * 0.22 * dt
        }

        // — muebles —
        for (const w of walls.current) {
          const wx = c.x - w.x
          const wy = c.y - w.y
          const wd = Math.hypot(wx, wy)
          const min = w.r + R
          if (wd < min && wd > 0.001) {
            c.x = w.x + (wx / wd) * min
            c.y = w.y + (wy / wd) * min
            c.vx += (wx / wd) * 120 * dt
            c.vy += (wy / wd) * 120 * dt
          }
        }

        const damp = settled ? 0.80 : 0.925
        c.vx *= damp
        c.vy *= damp

        const sp = Math.hypot(c.vx, c.vy)
        const max = scared ? MAX_V : MAX_V * 0.62
        if (sp > max) {
          c.vx = (c.vx / sp) * max
          c.vy = (c.vy / sp) * max
        }

        c.x += c.vx * dt
        c.y += c.vy * dt

        if (c.x < R) (c.x = R), (c.vx = Math.abs(c.vx) * 0.55)
        if (c.x > b.width - R) (c.x = b.width - R), (c.vx = -Math.abs(c.vx) * 0.55)
        if (c.y < R) (c.y = R), (c.vy = Math.abs(c.vy) * 0.55)
        if (c.y > b.height - R) (c.y = b.height - R), (c.vy = -Math.abs(c.vy) * 0.55)

        if (Math.abs(c.vx) > 8) c.flip = c.vx < 0
        c.state = c.scare > 0.15 ? 'scared' : settled ? 'calm' : sp > 26 ? 'walk' : 'sit'
      }

      const n = list.filter((c) => c.x > p.x && c.x < p.x + p.w && c.y > p.y && c.y < p.y + p.h).length
      setInside(n)
      hold.current = n === list.length ? hold.current + dt : 0
      setTime((t) => t + dt)

      if (hold.current >= HOLD) {
        setTime((t) => {
          setBest((prev) => {
            const key = String(round)
            if (prev[key] != null && prev[key] <= t) return prev
            const next = { ...prev, [key]: t }
            try {
              localStorage.setItem(STORE, JSON.stringify(next))
            } catch {
              /* modo privado */
            }
            return next
          })
          return t
        })
        setStatus('won')
        return
      }

      force((v) => v + 1)
      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [status, round])

  // si la pestaña se va, no seguimos corriendo el reloj
  useEffect(() => {
    const hide = () => document.hidden && setStatus((s) => (s === 'playing' ? 'idle' : s))
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [])

  /* — mando: vale igual con ratón que con el dedo — */
  const track = (e) => {
    const b = e.currentTarget.getBoundingClientRect()
    mouse.current = { x: e.clientX - b.left, y: e.clientY - b.top, on: true }
  }
  const clap = () => {
    const { x, y } = mouse.current
    for (const c of cats.current) {
      const dx = c.x - x
      const dy = c.y - y
      const d = Math.hypot(dx, dy)
      if (d > FLEE * 1.7 || d < 0.001) continue
      const push = (1 - d / (FLEE * 1.7)) * 330
      c.vx += (dx / d) * push
      c.vy += (dy / d) * push
      c.calm = 0
      c.scare = 1
    }
  }
  const release = () => (mouse.current = { x: -999, y: -999, on: false })

  const p = pen.current
  const progress = Math.min(hold.current / HOLD, 1)
  const total = catsFor(round)
  const bestNow = best[String(round)]

  return (
    <div className="flex h-full flex-col px-4 pt-4 pb-4">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="serif text-[22px]">
          Pastorea a los gatos <span style={{ color: 'var(--tx-3)' }}>· ronda {round}</span>
        </h3>
        <div className="tnum flex items-center gap-3 text-[12px]" style={{ color: 'var(--tx-2)' }}>
          <span>
            {inside}/{total}
          </span>
          <span>{time.toFixed(1)}s</span>
          {bestNow != null && <span style={{ color: 'var(--tx-3)' }}>mejor {bestNow.toFixed(1)}s</span>}
        </div>
      </header>

      <div
        ref={boxRef}
        onPointerMove={track}
        onPointerDown={(e) => {
          track(e)
          clap()
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
        className="relative min-h-0 flex-1 touch-none overflow-hidden rounded-xl"
        style={{ background: 'var(--bg-deep)', border: '1px solid var(--line)', cursor: 'crosshair' }}
      >
        {/* muebles */}
        {walls.current.map((w, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: w.x - w.r,
              top: w.y - w.r,
              width: w.r * 2,
              height: w.r * 2,
              background: 'var(--panel-2)',
              border: '1px solid var(--line-2)',
            }}
          />
        ))}

        {/* alfombra */}
        <div
          className="absolute rounded-lg transition-colors duration-200"
          style={{
            left: p.x,
            top: p.y,
            width: p.w,
            height: p.h,
            border: `1.5px dashed ${progress > 0 ? 'var(--accent)' : 'var(--tx-3)'}`,
            background: progress > 0 ? 'var(--accent-soft)' : 'transparent',
          }}
        >
          <span className="label absolute inset-x-0 top-2 text-center">alfombra</span>
          {progress > 0 && (
            <span
              className="absolute right-2 bottom-2 left-2 h-[3px] rounded-full"
              style={{ background: 'var(--accent)', transform: `scaleX(${progress})`, transformOrigin: 'left' }}
            />
          )}
        </div>

        {/* alcance del susto */}
        {status === 'playing' && mouse.current.on && (
          <div
            className="pointer-events-none absolute rounded-full"
            style={{
              left: mouse.current.x - FLEE,
              top: mouse.current.y - FLEE,
              width: FLEE * 2,
              height: FLEE * 2,
              border: '1px solid var(--line-2)',
              background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 8%, transparent), transparent 70%)',
            }}
          />
        )}

        {cats.current.map((c) => (
          <MiniCat key={c.id} x={c.x} y={c.y} flip={c.flip} state={c.state} />
        ))}

        {status !== 'playing' && (
          <div
            className="fade-in absolute inset-0 grid place-items-center backdrop-blur-[2px]"
            style={{ background: 'color-mix(in srgb, var(--panel) 88%, transparent)' }}
          >
            <div className="px-6 text-center">
              {status === 'won' ? (
                <>
                  <p className="serif text-[27px]">Todos dentro</p>
                  <p className="tnum mt-1 text-[14px]" style={{ color: 'var(--accent)' }}>
                    {time.toFixed(1)}s
                    {bestNow != null && bestNow < time && (
                      <span style={{ color: 'var(--tx-3)' }}> · mejor {bestNow.toFixed(1)}s</span>
                    )}
                  </p>
                  <div className="mt-5 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => start(round + 1)}
                      className="rounded-lg px-6 py-2.5 text-[13.5px] font-medium transition-transform duration-200 hover:scale-[1.02]"
                      style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
                    >
                      Ronda {round + 1} · {catsFor(round + 1)} gatos
                    </button>
                    <button
                      type="button"
                      onClick={() => start(round)}
                      className="rounded-lg px-4 py-2.5 text-[13px] transition-colors duration-200"
                      style={{ border: '1px solid var(--line-2)', color: 'var(--tx-2)' }}
                    >
                      Repetir
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="serif text-[26px]">Métemelos en la alfombra</p>
                  <p className="mx-auto mt-2 max-w-[40ch] text-[13px]" style={{ color: 'var(--tx-2)' }}>
                    Huyen del cursor y se mueven en manada: empuja por un lado y van juntos, persíguelos y
                    se desparraman. Dentro se acomodan, pero se aburren y se van.
                  </p>
                  <button
                    type="button"
                    onClick={() => start(round)}
                    className="mt-5 rounded-lg px-7 py-3 text-[13.5px] font-medium transition-transform duration-200 hover:scale-[1.02]"
                    style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
                  >
                    Empezar · {catsFor(round)} gatos
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Gato de planta con cuatro estados: andando, sentado, asustado y acomodado. */
function MiniCat({ x, y, flip, state }) {
  const line = 'var(--tx-2)'
  const fill = state === 'calm' ? 'var(--accent-soft)' : 'var(--panel-2)'

  if (state === 'calm') {
    return (
      <svg
        width="26"
        height="26"
        viewBox="0 0 26 26"
        className="pointer-events-none absolute"
        style={{ left: x - 13, top: y - 13, transform: flip ? 'scaleX(-1)' : 'none' }}
      >
        {/* hecho un ovillo */}
        <ellipse cx="13" cy="15" rx="8.5" ry="6.5" fill={fill} stroke={line} strokeWidth="1.1" />
        <circle cx="9" cy="14" r="4.2" fill={fill} stroke={line} strokeWidth="1.1" />
        <path d="m6.4 11.4-.5-2.6 2.3 1.3M11.6 11.4l.5-2.6-2.3 1.3" fill={fill} stroke={line} strokeWidth="1" strokeLinejoin="round" />
        <path d="M7.2 14h1.4M9.8 14h1.4" stroke={line} strokeWidth="1" strokeLinecap="round" />
        <path d="M20.4 16.6c2.2-.6 2.6-3 1-4" fill="none" stroke={line} strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    )
  }

  const scared = state === 'scared'
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      className="pointer-events-none absolute"
      style={{ left: x - 13, top: y - 13, transform: flip ? 'scaleX(-1)' : 'none' }}
    >
      <ellipse cx="13" cy="15" rx="7" ry="8" fill={fill} stroke={scared ? 'var(--accent)' : line} strokeWidth="1.1" />
      <circle cx="13" cy="9" r="5" fill={state === 'walk' ? 'var(--panel)' : fill} stroke={scared ? 'var(--accent)' : line} strokeWidth="1.1" />
      {/* orejas: hacia atrás cuando se asusta */}
      <path
        d={
          scared
            ? 'm9.4 6.6-2.6-2 .6 3M16.6 6.6l2.6-2-.6 3'
            : 'm9.6 6.2-.7-3.2 2.8 1.6M16.4 6.2l.7-3.2-2.8 1.6'
        }
        fill={fill}
        stroke={scared ? 'var(--accent)' : line}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      {/* ojos: como platos si está asustado */}
      {scared ? (
        <>
          <circle cx="11.3" cy="9" r="1.5" fill="var(--tx)" />
          <circle cx="14.7" cy="9" r="1.5" fill="var(--tx)" />
        </>
      ) : (
        <path d="M11.3 9h.02M14.7 9h.02" stroke="var(--tx)" strokeWidth="1.8" strokeLinecap="round" />
      )}
      {/* cola: tiesa al huir */}
      <path
        d={scared ? 'M19.6 15c3-2 2.6-5.4.4-6.4' : state === 'walk' ? 'M19.4 17c3-1 3.6-4 1.6-5.2' : 'M19.4 18c3 .6 4.2-1.6 3-3.4'}
        fill="none"
        stroke={scared ? 'var(--accent)' : line}
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  )
}
