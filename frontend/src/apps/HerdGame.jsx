import { useCallback, useEffect, useRef, useState } from 'react'
import onekoSprite from '../assets/oneko.gif'

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
 * Se dibuja en canvas con la hoja de sprites de oneko: el gato del juego, el
 * que pasea por el escritorio y el del favicon son el mismo personaje. La
 * habitación —tablas, alfombra, muebles— se pinta una vez por tamaño en una
 * capa aparte; cada fotograma sólo vuelve a pintar lo que se mueve.
 *
 * Física, IA, rondas y dibujo escritos aquí. Sin librerías.
 */

const F = 32 // lado del fotograma en la hoja
const HOLD = 1.6 // s que tienen que aguantar todos dentro
const BORED = 4.2 // s acomodado antes de aburrirse y salir
const STORE = 'herd-best'

const catsFor = (round) => 3 + round
const obstaclesFor = (round) => (round < 2 ? 0 : round < 4 ? 1 : 2)

const dpr = () => Math.min(3, window.devicePixelRatio || 1)
/* Escala del gato, ENTERA en píxeles de dispositivo: cada píxel del sprite cae
   en un número exacto de píxeles reales y se ve nítido. En una pantalla 2x
   sale 1,5 (48 px); en una 1x, 2 (64 px). */
const scaleFor = (d) => Math.max(2, Math.round(1.5 * d)) / d

/* Fotogramas de la hoja de oneko, como [columna, fila]. Los mismos que usa el
   gato del escritorio en components/Cat.jsx. */
const SET = {
  idle: [[3, 3]],
  alert: [[7, 3]],
  lick: [
    [5, 0],
    [6, 0],
    [7, 0],
  ],
  tired: [[3, 2]],
  sleeping: [
    [2, 0],
    [2, 1],
  ],
  E: [
    [3, 0],
    [3, 1],
  ],
  SE: [
    [5, 1],
    [5, 2],
  ],
  S: [
    [6, 3],
    [7, 2],
  ],
  SW: [
    [5, 3],
    [6, 1],
  ],
  W: [
    [4, 2],
    [4, 3],
  ],
  NW: [
    [1, 0],
    [1, 1],
  ],
  N: [
    [1, 2],
    [1, 3],
  ],
  NE: [
    [0, 2],
    [0, 3],
  ],
}
// por ángulo de la velocidad, de 0 a 2π en octavos, con la y hacia abajo
const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']

const hoja = new Image()
hoja.src = onekoSprite

const isDark = () => document.documentElement.dataset.theme !== 'light'
const reducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* La habitación: madera de miel de día, nogal de noche. La alfombra es
   terracota con el motivo en el ámbar del sitio. */
const paleta = (dark) =>
  dark
    ? {
        tablas: ['#6a4629', '#765030', '#5f3e24', '#704b2c'],
        junta: 'rgba(25,14,6,.6)',
        veta: 'rgba(255,215,170,.045)',
        vineta: 'rgba(0,0,0,.5)',
        alfombra: '#8b4034',
        borde: '#672c22',
        motivo: '#dca263',
        fleco: '#bda88a',
        sombra: 'rgba(0,0,0,.4)',
        polvo: 'rgba(210,180,140,.5)',
      }
    : {
        tablas: ['#caa274', '#d5ad80', '#c0976b', '#cea67a'],
        junta: 'rgba(95,58,25,.35)',
        veta: 'rgba(255,255,255,.12)',
        vineta: 'rgba(70,40,15,.26)',
        alfombra: '#b9573f',
        borde: '#8e3c2b',
        motivo: '#eab86c',
        fleco: '#ebdcbc',
        sombra: 'rgba(45,22,6,.3)',
        polvo: 'rgba(120,85,50,.35)',
      }

export default function HerdGame() {
  const boxRef = useRef(null)
  const canvasRef = useRef(null)
  const escena = useRef(null) // la capa estática ya pintada
  const S = useRef(1.5)
  const cats = useRef([])
  const walls = useRef([])
  const polvo = useRef([])
  const pen = useRef({ x: 0, y: 0, w: 0, h: 0 })
  const mouse = useRef({ x: -999, y: -999, on: false })
  const hold = useRef(0)
  const reloj = useRef(0)
  const statusRef = useRef('idle')

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
  statusRef.current = status

  /* ── dibujo ──────────────────────────────────────────────────────── */

  const draw = useCallback((t = performance.now() / 1000) => {
    const cv = canvasRef.current
    if (!cv) return
    const d = dpr()
    const ctx = cv.getContext('2d')
    ctx.setTransform(d, 0, 0, d, 0, 0)
    const w = cv.width / d
    const h = cv.height / d
    const s = S.current
    const pal = paleta(isDark())
    const p = pen.current
    const FLEE = 64 * s

    ctx.imageSmoothingEnabled = true
    if (escena.current) ctx.drawImage(escena.current, 0, 0, w, h)
    else {
      ctx.fillStyle = pal.tablas[0]
      ctx.fillRect(0, 0, w, h)
    }

    // la alfombra se enciende mientras aguantan todos dentro
    const progreso = Math.min(hold.current / HOLD, 1)
    if (progreso > 0) {
      ctx.fillStyle = pal.motivo
      ctx.globalAlpha = 0.16 + progreso * 0.12
      ctx.fillRect(p.x, p.y, p.w, p.h)
      ctx.globalAlpha = 1
      ctx.fillRect(p.x + 10, p.y + p.h - 6, (p.w - 20) * progreso, 3)
    }

    // el cursor es una sombra que se cierne, no un disco con borde
    const m = mouse.current
    if (statusRef.current === 'playing' && m.on) {
      const g = ctx.createRadialGradient(m.x, m.y + 4, 0, m.x, m.y + 4, FLEE * 0.62)
      g.addColorStop(0, 'rgba(40,20,5,.26)')
      g.addColorStop(1, 'rgba(40,20,5,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(m.x, m.y + 4, FLEE * 0.62, FLEE * 0.44, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // polvo de las carreras
    ctx.fillStyle = pal.polvo
    for (const q of polvo.current) {
      const k = q.t / 0.45
      ctx.globalAlpha = (1 - k) * 0.9
      ctx.beginPath()
      ctx.arc(q.x, q.y, 1.5 + k * 7 * (s / 1.5), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // gatos, de atrás hacia delante
    const size = F * s
    const lista = [...cats.current].sort((a, b) => a.y - b.y)
    for (const c of lista) {
      ctx.fillStyle = 'rgba(30,15,5,.22)'
      ctx.beginPath()
      ctx.ellipse(c.x, c.y + size * 0.3, size * 0.3, size * 0.1, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    if (!hoja.complete) return
    ctx.imageSmoothingEnabled = false
    for (const c of lista) {
      const [[col, row], espejo] = fotograma(c, t)
      // a píxel de dispositivo, para que el sprite no baile entre dos píxeles
      const dx = Math.round((c.x - size / 2) * d) / d
      const dy = Math.round((c.y - size * 0.64) * d) / d
      if (espejo && c.flip) {
        ctx.save()
        ctx.translate(dx + size, dy)
        ctx.scale(-1, 1)
        ctx.drawImage(hoja, col * F, row * F, F, F, 0, 0, size, size)
        ctx.restore()
      } else {
        ctx.drawImage(hoja, col * F, row * F, F, F, dx, dy, size, size)
      }
    }
    ctx.imageSmoothingEnabled = true
  }, [])

  /* ── colocación del tablero y capa estática ─────────────────────── */

  const layout = useCallback(() => {
    const el = boxRef.current
    const cv = canvasRef.current
    if (!el || !cv) return
    const b = el.getBoundingClientRect()
    const d = dpr()
    S.current = scaleFor(d)
    cv.width = Math.round(b.width * d)
    cv.height = Math.round(b.height * d)
    cv.style.width = `${b.width}px`
    cv.style.height = `${b.height}px`

    const pw = Math.max(120, Math.min(210, b.width * 0.36))
    const ph = Math.max(96, Math.min(160, b.height * 0.38))
    pen.current = { x: b.width - pw - 22, y: b.height - ph - 22, w: pw, h: ph }

    const off = document.createElement('canvas')
    off.width = cv.width
    off.height = cv.height
    const octx = off.getContext('2d')
    octx.scale(d, d)
    pintarHabitacion(octx, b.width, b.height, pen.current, walls.current, paleta(isDark()), S.current)
    escena.current = off
    draw()
  }, [draw])

  useEffect(() => {
    layout()
    const ro = new ResizeObserver(layout)
    if (boxRef.current) ro.observe(boxRef.current)
    // al cambiar de tema, la madera cambia con él
    const mo = new MutationObserver(layout)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const onLoad = () => draw()
    hoja.addEventListener('load', onLoad)
    return () => {
      ro.disconnect()
      mo.disconnect()
      hoja.removeEventListener('load', onLoad)
    }
  }, [layout, draw])

  const start = useCallback(
    (n) => {
      const el = boxRef.current
      if (!el) return
      const b = el.getBoundingClientRect()
      const s = S.current
      const R = 9 * s

      // muebles: fijos, lejos de la alfombra; una planta y una caja
      walls.current = Array.from({ length: obstaclesFor(n) }, (_, i) => ({
        x: b.width * (i === 0 ? 0.44 : 0.22),
        y: b.height * (i === 0 ? 0.36 : 0.7),
        r: (19 + i * 4) * s,
        kind: i === 0 ? 'planta' : 'caja',
      }))
      layout()

      cats.current = Array.from({ length: catsFor(n) }, (_, i) => ({
        id: i,
        x: R * 2 + Math.random() * Math.max(50, b.width * 0.42),
        y: R * 2 + Math.random() * Math.max(50, b.height * 0.55),
        vx: 0,
        vy: 0,
        wander: Math.random() * Math.PI * 2,
        flip: Math.random() < 0.5,
        calm: 0,
        scare: 0,
        paso: Math.random() * 2,
        quieto: 0,
        lame: 0,
        state: 'sit',
      }))
      polvo.current = []

      hold.current = 0
      reloj.current = 0
      setTime(0)
      setInside(0)
      setRound(n)
      setStatus('playing')
    },
    [layout]
  )

  /* ── bucle ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (status !== 'playing') {
      draw()
      return
    }
    let raf
    let last = performance.now()
    let tick = 0
    const sinPolvo = reducido()

    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 0.04)
      last = now
      const el = boxRef.current
      if (!el) return
      const b = el.getBoundingClientRect()
      const p = pen.current
      const list = cats.current
      const s = S.current
      const R = 9 * s
      const FLEE = 64 * s
      const MAX_V = 150 * s

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
          const push = (1 - d / FLEE) ** 2 * 1150 * (s / 1.5)
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
            if (od < 73 * s) {
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

        const damp = settled ? 0.8 : 0.925
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
        c.state = c.scare > 0.15 ? 'scared' : settled ? 'calm' : sp > 26 * (s / 1.5) ? 'walk' : 'sit'

        // — animación: las patas van con la distancia, y el que se queda quieto se lava —
        c.paso += (sp * dt) / (9 * s)
        c.lame = Math.max(0, c.lame - dt)
        if (c.state === 'sit') {
          c.quieto += dt
          if (c.quieto > 2.2 && c.lame === 0 && Math.random() < dt * 0.45) c.lame = 0.75
        } else {
          c.quieto = 0
        }
        if (!sinPolvo && sp > MAX_V * 0.5 && Math.random() < dt * 16) {
          polvo.current.push({
            x: c.x - c.vx * 0.05 + (Math.random() - 0.5) * 8,
            y: c.y + F * s * 0.28,
            vx: -c.vx * 0.06 + (Math.random() - 0.5) * 24,
            vy: -8 - Math.random() * 14,
            t: 0,
          })
        }
      }

      for (const q of polvo.current) {
        q.t += dt
        q.x += q.vx * dt
        q.y += q.vy * dt
      }
      polvo.current = polvo.current.filter((q) => q.t < 0.45)

      const n = list.filter((c) => c.x > p.x && c.x < p.x + p.w && c.y > p.y && c.y < p.y + p.h).length
      setInside((v) => (v === n ? v : n))
      hold.current = n === list.length ? hold.current + dt : 0
      reloj.current += dt
      // el marcador se refresca a 10 Hz: React no tiene por qué pintar 60 veces por segundo
      tick += dt
      if (tick > 0.1) {
        tick = 0
        setTime(reloj.current)
      }

      if (hold.current >= HOLD) {
        const t = reloj.current
        setTime(t)
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
        setStatus('won')
        draw(now / 1000)
        return
      }

      draw(now / 1000)
      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [status, round, draw])

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
    const FLEE = 64 * S.current
    for (const c of cats.current) {
      const dx = c.x - x
      const dy = c.y - y
      const d = Math.hypot(dx, dy)
      if (d > FLEE * 1.7 || d < 0.001) continue
      const push = (1 - d / (FLEE * 1.7)) * 330 * (S.current / 1.5)
      c.vx += (dx / d) * push
      c.vy += (dy / d) * push
      c.calm = 0
      c.scare = 1
    }
  }
  const release = () => (mouse.current = { x: -999, y: -999, on: false })

  const total = catsFor(round)
  const bestNow = best[String(round)]

  return (
    <div className="flex h-full flex-col px-4 pt-4 pb-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="serif text-[22px]">
          Pastorea a los gatos <span style={{ color: 'var(--tx-3)' }}>· ronda {round}</span>
        </h3>
        <Lcd inside={inside} total={total} time={time} best={bestNow} />
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
        style={{
          border: '1px solid var(--line-2)',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,.25)',
          cursor: status === 'playing' ? 'none' : 'default',
        }}
      >
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />

        {status !== 'playing' && (
          <div
            className="fade-in absolute inset-0 grid place-items-center backdrop-blur-[2px]"
            style={{ background: 'color-mix(in srgb, var(--panel) 84%, transparent)' }}
          >
            <div className="px-6 text-center">
              <Sprite frame={status === 'won' ? SET.sleeping[0] : SET.idle[0]} />
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
                    Huyen de tu sombra y se mueven en manada: empuja por un lado y van juntos, persíguelos y
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

/* ── el fotograma de cada gato ────────────────────────────────────── */

/** Devuelve [[col, fila], espejable]: los fotogramas quietos se pueden volver
 *  hacia donde iba el gato; los de andar ya tienen sus ocho direcciones. */
function fotograma(c, t) {
  if (c.state === 'calm') {
    if (c.calm < 0.9) return [SET.tired[0], true]
    return [SET.sleeping[Math.floor(t / 0.7) % 2], true]
  }
  if (c.state === 'scared') return [SET.alert[0], true]
  if (c.state === 'walk') {
    const a = Math.atan2(c.vy, c.vx)
    const dir = DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]
    return [SET[dir][Math.floor(c.paso) % 2], false]
  }
  if (c.lame > 0) return [SET.lick[Math.floor((0.75 - c.lame) * 6) % 3], true]
  return [SET.idle[0], true]
}

/* ── la habitación, pintada una vez por tamaño ────────────────────── */

function pintarHabitacion(ctx, w, h, p, walls, pal, s) {
  // tablas de madera, con un azar fijo para que no cambien al repintar
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const T = 24
  for (let y = 0, row = 0; y < h; y += T, row++) {
    let x = -((row % 2) * 70 + (row % 3) * 35)
    while (x < w) {
      const len = 110 + rnd() * 90
      ctx.fillStyle = pal.tablas[Math.floor(rnd() * pal.tablas.length)]
      ctx.fillRect(x, y, len, T)
      ctx.strokeStyle = pal.veta
      ctx.lineWidth = 1
      const vy = y + 6 + rnd() * (T - 12)
      ctx.beginPath()
      ctx.moveTo(x + 6, vy)
      ctx.quadraticCurveTo(x + len / 2, vy + (rnd() - 0.5) * 6, x + len - 6, vy)
      ctx.stroke()
      ctx.fillStyle = pal.junta
      ctx.fillRect(x + len - 1, y, 1, T)
      x += len
    }
    ctx.fillStyle = pal.junta
    ctx.fillRect(0, y + T - 1, w, 1)
  }
  // viñeta: la luz cae en el centro
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.78)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, pal.vineta)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  pintarAlfombra(ctx, p, pal)
  for (const m of walls) pintarMueble(ctx, m, pal, s)
}

function pintarAlfombra(ctx, p, pal) {
  const { x, y, w, h } = p
  ctx.save()
  ctx.shadowColor = pal.sombra
  ctx.shadowBlur = 16
  ctx.shadowOffsetY = 6
  ctx.fillStyle = pal.alfombra
  ctx.fillRect(x, y, w, h)
  ctx.restore()

  const b = 9
  ctx.fillStyle = pal.borde
  ctx.fillRect(x, y, w, b)
  ctx.fillRect(x, y + h - b, w, b)
  ctx.fillRect(x, y, b, h)
  ctx.fillRect(x + w - b, y, b, h)

  ctx.strokeStyle = pal.motivo
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.7
  ctx.strokeRect(x + b + 2.5, y + b + 2.5, w - 2 * b - 5, h - 2 * b - 5)
  ctx.globalAlpha = 0.55
  ctx.fillStyle = pal.motivo
  const paso = 22
  const r = 4.5
  for (let yy = y + b + 15, fila = 0; yy < y + h - b - 9; yy += paso, fila++) {
    for (let xx = x + b + 15 + (fila % 2) * (paso / 2); xx < x + w - b - 9; xx += paso) {
      ctx.beginPath()
      ctx.moveTo(xx, yy - r)
      ctx.lineTo(xx + r, yy)
      ctx.lineTo(xx, yy + r)
      ctx.lineTo(xx - r, yy)
      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1

  // flecos a los lados
  ctx.strokeStyle = pal.fleco
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  for (let yy = y + 3, k = 0; yy < y + h - 2; yy += 4, k++) {
    const dy = k % 2 ? 1 : -1
    ctx.beginPath()
    ctx.moveTo(x, yy)
    ctx.lineTo(x - 7, yy + dy)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + w, yy)
    ctx.lineTo(x + w + 7, yy - dy)
    ctx.stroke()
  }
}

function pintarMueble(ctx, m, pal, s) {
  const { x, y, r } = m
  ctx.fillStyle = pal.sombra
  ctx.beginPath()
  ctx.ellipse(x, y + r * 0.7, r * 1.1, r * 0.4, 0, 0, Math.PI * 2)
  ctx.fill()
  if (m.kind === 'planta') planta(ctx, x, y, r)
  else caja(ctx, x, y, r)
}

function planta(ctx, x, y, r) {
  const pw = r * 1.25
  const ph = r * 0.95
  ctx.fillStyle = '#b1633d'
  ctx.beginPath()
  ctx.moveTo(x - pw / 2, y - 2)
  ctx.lineTo(x + pw / 2, y - 2)
  ctx.lineTo(x + pw / 2 - 4, y + ph)
  ctx.lineTo(x - pw / 2 + 4, y + ph)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#c9764c'
  ctx.fillRect(x - pw / 2 - 2, y - 8, pw + 4, 7)
  ctx.fillStyle = 'rgba(0,0,0,.18)'
  ctx.fillRect(x + pw / 2 - 9, y - 1, 5, ph - 2)
  const verdes = ['#4e7b3a', '#6b9c49', '#3d6430', '#5f8f42']
  ctx.lineCap = 'round'
  for (let k = 0; k < 8; k++) {
    const a = -Math.PI / 2 + (k - 3.5) * 0.38
    const len = r * (0.95 + (k % 3) * 0.28)
    ctx.strokeStyle = verdes[k % verdes.length]
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(x, y - 6)
    ctx.quadraticCurveTo(
      x + Math.cos(a) * len * 0.55,
      y - 6 + Math.sin(a) * len * 0.55 - 10,
      x + Math.cos(a) * len,
      y - 6 + Math.sin(a) * len
    )
    ctx.stroke()
  }
}

function caja(ctx, x, y, r) {
  const s = r * 1.75
  const top = y - s / 2 + 6
  ctx.fillStyle = '#c9a168'
  ctx.fillRect(x - s / 2, top, s, s - 6)
  ctx.fillStyle = 'rgba(0,0,0,.14)'
  ctx.fillRect(x - s / 2, top, s, 7)
  ctx.fillStyle = '#d8b57d'
  ctx.beginPath()
  ctx.moveTo(x - s / 2, top)
  ctx.lineTo(x - s / 2 - 11, top - 11)
  ctx.lineTo(x - 2, top - 11)
  ctx.lineTo(x, top)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x + s / 2, top)
  ctx.lineTo(x + s / 2 + 11, top - 11)
  ctx.lineTo(x + 2, top - 11)
  ctx.lineTo(x, top)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(80,50,20,.45)'
  ctx.lineWidth = 1
  ctx.strokeRect(x - s / 2 + 0.5, top + 0.5, s - 1, s - 7)
  ctx.fillStyle = 'rgba(120,80,30,.35)'
  ctx.fillRect(x - 3, top, 6, s - 6)
}

/* ── piezas de interfaz ───────────────────────────────────────────── */

/** Marcador: la misma pantallita ámbar que el reproductor. */
function Lcd({ inside, total, time, best }) {
  return (
    <div
      className="tnum flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1 text-[12px] font-medium"
      style={{
        background: '#e8b866',
        color: '#20150a',
        border: '1px solid #b98a3f',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,.28), 0 1px 0 rgba(255,255,255,.25)',
      }}
    >
      <span>
        {inside}
        <span style={{ opacity: 0.5 }}>/{total}</span>
      </span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span>{time.toFixed(1)}s</span>
      {best != null && (
        <>
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ opacity: 0.6 }}>mejor {best.toFixed(1)}</span>
        </>
      )}
    </div>
  )
}

/** Un fotograma del gato, en grande, para las pantallas de inicio y final. */
function Sprite({ frame: [col, row] }) {
  const k = 2
  return (
    <div
      aria-hidden="true"
      className="mx-auto mb-2"
      style={{
        width: F * k,
        height: F * k,
        backgroundImage: `url(${onekoSprite})`,
        backgroundSize: `${F * k * 8}px ${F * k * 4}px`,
        backgroundPosition: `${-col * F * k}px ${-row * F * k}px`,
        imageRendering: 'pixelated',
      }}
    />
  )
}
