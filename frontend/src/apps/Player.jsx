import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useContent } from '../lib/content'
import { usePointerDrag } from '../hooks/usePointerDrag'

/**
 * Reproductor portátil.
 *
 * Aparato físico con pantalla LCD ámbar y rueda giratoria: arrastras el aro
 * para moverte por el menú (o para buscar dentro de la pista) y pulsas el
 * centro para seleccionar. Carcasa, proporciones, paleta y rotulación son
 * propias — no es una réplica de ningún aparato comercial.
 *
 * Si una pista trae `src`, suena de verdad; si no, la reproducción se simula
 * para que la interfaz esté viva.
 */

const STEP = 26 // grados de giro por paso del menú

export default function Player({ onNowPlaying }) {
  const { tracks } = useContent()
  const [screen, setScreen] = useState('menu') // menu | playing
  const [sel, setSel] = useState(0)
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [lit, setLit] = useState(true)
  const [ringAngle, setRingAngle] = useState(0)

  const audioRef = useRef(null)
  const listRef = useRef(null)
  const track = tracks[i]

  // la barra superior enseña lo que suena
  useEffect(() => {
    onNowPlaying?.(playing ? { title: track.title, artist: track.artist } : null)
  }, [playing, track.title, track.artist, onNowPlaying])

  useEffect(() => () => onNowPlaying?.(null), [onNowPlaying])

  /* — reproducción — */
  useEffect(() => {
    if (!playing || track.src) return
    const id = setInterval(() => {
      setT((v) => {
        if (v + 0.25 >= track.dur) {
          setI((n) => (n + 1) % tracks.length)
          return 0
        }
        return v + 0.25
      })
    }, 250)
    return () => clearInterval(id)
  }, [playing, i, track.src, track.dur])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (playing) a.play().catch(() => setPlaying(false))
    else a.pause()
  }, [playing, i])

  const next = useCallback(() => {
    setI((n) => (n + 1) % tracks.length)
    setT(0)
    setPlaying(true)
  }, [])

  const prev = useCallback(() => {
    setT((v) => {
      if (v > 3) return 0
      setI((n) => (n - 1 + tracks.length) % tracks.length)
      return 0
    })
  }, [])

  /* — navegación — */
  const scroll = useCallback(
    (dir) => {
      setLit(true)
      if (screen === 'playing') {
        setT((v) => Math.max(0, Math.min(track.dur, v + dir * 5)))
        if (audioRef.current) audioRef.current.currentTime = Math.max(0, t + dir * 5)
      } else {
        setSel((s) => Math.max(0, Math.min(tracks.length - 1, s + dir)))
      }
    },
    [screen, track.dur, t]
  )

  const select = useCallback(() => {
    setLit(true)
    if (screen === 'menu') {
      setI(sel)
      setT(0)
      setPlaying(true)
      setScreen('playing')
    } else {
      setPlaying((p) => !p)
    }
  }, [screen, sel])

  const back = useCallback(() => {
    setLit(true)
    if (screen === 'playing') setScreen('menu')
  }, [screen])

  // mantener el elemento seleccionado a la vista
  useEffect(() => {
    listRef.current?.children[sel]?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  /* — rueda: arrastre angular — */
  const wheelRef = useRef(null)
  const acc = useRef(0)

  const angleAt = (cx, cy, x, y) => (Math.atan2(y - cy, x - cx) * 180) / Math.PI

  const dial = usePointerDrag({
    onStart: (e) => {
      const r = wheelRef.current.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      acc.current = 0
      return { cx, cy, last: angleAt(cx, cy, e.clientX, e.clientY) }
    },
    onMove: ({ x, y, ctx }) => {
      const a = angleAt(ctx.cx, ctx.cy, x, y)
      let d = a - ctx.last
      if (d > 180) d -= 360
      if (d < -180) d += 360
      ctx.last = a
      acc.current += d
      setRingAngle((v) => v + d)
      while (Math.abs(acc.current) >= STEP) {
        const dir = acc.current > 0 ? 1 : -1
        scroll(dir)
        acc.current -= dir * STEP
      }
    },
  })

  const pct = Math.min(t / track.dur, 1)

  /* — pantalla — */
  const lcdInk = lit ? '#20150a' : '#5d5a52'
  const lcdBg = lit ? '#e8b866' : '#9a9a90'

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      {track.src && (
        <audio
          ref={audioRef}
          src={track.src}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
          onEnded={next}
        />
      )}

      {/* carcasa */}
      <div
        className="flex select-none flex-col gap-4 rounded-[26px] p-4"
        style={{
          width: 246,
          background: 'linear-gradient(168deg, var(--panel-2), var(--bg-deep) 78%)',
          border: '1px solid var(--line-2)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,.09), inset 0 -1px 0 rgba(0,0,0,.35), 0 14px 34px -10px rgba(0,0,0,.6)',
        }}
      >
        {/* rótulo del aparato */}
        <div className="flex items-baseline justify-between px-0.5">
          <span className="serif text-[13px] leading-none" style={{ color: 'var(--tx-2)' }}>
            Cinta
          </span>
          <span className="text-[9px] font-medium tracking-[0.1em] uppercase" style={{ color: 'var(--tx-2)' }}>
            mod. 01
          </span>
        </div>

        {/* pantalla LCD */}
        <div
          className="relative overflow-hidden rounded-[7px]"
          style={{
            height: 158,
            background: lcdBg,
            border: '1px solid rgba(0,0,0,.55)',
            boxShadow: 'inset 0 2px 5px rgba(0,0,0,.28)',
            transition: 'background .3s var(--ease)',
          }}
        >
          {/* barra de estado */}
          <div
            className="flex h-[19px] items-center justify-between px-2 text-[9px] font-medium tracking-wide"
            style={{ color: lcdInk, borderBottom: `1px solid ${lcdInk}` }}
          >
            <span className="w-4">{playing ? <TinyPlay c={lcdInk} /> : <TinyPause c={lcdInk} />}</span>
            <span className="uppercase">{screen === 'menu' ? 'Canciones' : 'Sonando'}</span>
            <Battery c={lcdInk} />
          </div>

          {screen === 'menu' ? (
            <div ref={listRef} className="h-[calc(100%-19px)] overflow-hidden">
              {tracks.map((tr, n) => (
                <button
                  key={tr.title}
                  type="button"
                  onClick={() => {
                    setSel(n)
                    setLit(true)
                  }}
                  onDoubleClick={select}
                  className="flex w-full items-center justify-between px-2 py-[3px] text-left text-[11px]"
                  style={{
                    background: n === sel ? lcdInk : 'transparent',
                    color: n === sel ? lcdBg : lcdInk,
                  }}
                >
                  <span className="truncate">{tr.title}</span>
                  <span className="tnum ml-2 shrink-0 text-[9px] opacity-70">{clock(tr.dur)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex h-[calc(100%-19px)] flex-col px-2.5 pt-1.5 pb-2" style={{ color: lcdInk }}>
              <p className="tnum text-[9px] opacity-70">
                {i + 1} de {tracks.length}
              </p>
              <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
                <p className="line-clamp-2 text-[12px] leading-tight font-medium">{track.title}</p>
                <p className="text-[10px] opacity-75">{track.artist}</p>
              </div>
              <div
                className="h-[7px] overflow-hidden rounded-full"
                style={{ border: `1px solid ${lcdInk}` }}
              >
                <div
                  className="h-full"
                  style={{ width: `${pct * 100}%`, background: lcdInk, transition: 'width .2s linear' }}
                />
              </div>
              <div className="tnum mt-0.5 flex justify-between text-[9px]">
                <span>{clock(t)}</span>
                <span>−{clock(track.dur - t)}</span>
              </div>
            </div>
          )}

          {/* textura de LCD y reflejo del cristal */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'repeating-linear-gradient(0deg, rgba(0,0,0,.07) 0 1px, transparent 1px 2px), linear-gradient(160deg, rgba(255,255,255,.22), transparent 42%)',
            }}
          />
        </div>

        {/* rueda */}
        <div
          ref={wheelRef}
          {...dial}
          className="relative mx-auto touch-none"
          style={{ width: 190, height: 190, cursor: 'grab' }}
        >
          {/* aro */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle at 50% 22%, var(--panel-2), var(--bg-deep) 76%)',
              border: '1px solid var(--line-2)',
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,.4), inset 0 -1px 0 rgba(255,255,255,.06)',
            }}
          />

          {/* muescas que giran con el arrastre */}
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 h-full w-full"
            style={{ rotate: `${ringAngle}deg`, transition: 'rotate .06s linear' }}
            aria-hidden="true"
          >
            {Array.from({ length: 36 }, (_, n) => (
              <line
                key={n}
                x1="50"
                y1="7.5"
                x2="50"
                y2={n % 9 === 0 ? 12.5 : 10.5}
                stroke="var(--tx-3)"
                strokeWidth={n % 9 === 0 ? 1 : 0.6}
                strokeLinecap="round"
                opacity={n % 9 === 0 ? 0.85 : 0.4}
                transform={`rotate(${n * 10} 50 50)`}
              />
            ))}
          </svg>

          {/* rótulos del aro */}
          <RingLabel pos="top" onClick={back} label="Atrás" />
          <RingLabel pos="left" onClick={prev} icon="prev" />
          <RingLabel pos="right" onClick={next} icon="next" />
          <RingLabel pos="bottom" onClick={() => setPlaying((p) => !p)} icon={playing ? 'pause' : 'play'} />

          {/* botón central */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={select}
            aria-label={screen === 'menu' ? 'Reproducir seleccionada' : 'Reproducir o pausar'}
            className="absolute top-1/2 left-1/2 grid place-items-center rounded-full transition-transform duration-150 active:scale-[.97]"
            style={{
              width: 74,
              height: 74,
              marginLeft: -37,
              marginTop: -37,
              background: 'radial-gradient(circle at 50% 28%, var(--panel), var(--panel-2) 72%)',
              border: '1px solid var(--line-2)',
              boxShadow: '0 3px 8px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.12)',
              cursor: 'pointer',
            }}
          >
            <span
              className="h-2 w-2 rounded-full transition-colors duration-200"
              style={{ background: playing ? 'var(--accent)' : 'var(--tx-3)' }}
            />
          </button>
        </div>

        <p className="text-center text-[11px]" style={{ color: 'var(--tx-2)' }}>
          Gira el aro · pulsa el centro
        </p>
      </div>
    </div>
  )
}

/* — piezas — */

function RingLabel({ pos, onClick, label, icon }) {
  // por dentro de las muescas del aro, por fuera del botón central
  const place = {
    top: 'left-1/2 -translate-x-1/2 top-[29px]',
    bottom: 'left-1/2 -translate-x-1/2 bottom-[29px]',
    left: 'top-1/2 -translate-y-1/2 left-[26px]',
    right: 'top-1/2 -translate-y-1/2 right-[26px]',
  }[pos]

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      aria-label={label ?? icon}
      className={`absolute ${place} grid h-6 w-9 place-items-center rounded transition-colors duration-200`}
      style={{ color: 'var(--tx-2)', cursor: 'pointer' }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--tx)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--tx-2)')}
    >
      {label ? (
        <span className="text-[9px] font-medium tracking-[0.09em] uppercase">{label}</span>
      ) : (
        <Glyph kind={icon} />
      )}
    </button>
  )
}

function Glyph({ kind }) {
  const f = 'currentColor'
  if (kind === 'play')
    return (
      <svg width="11" height="11" viewBox="0 0 16 16" fill={f}>
        <path d="M4 2.6 13.4 8 4 13.4Z" />
      </svg>
    )
  if (kind === 'pause')
    return (
      <svg width="11" height="11" viewBox="0 0 16 16" fill={f}>
        <rect x="3.6" y="2.6" width="3.4" height="10.8" rx="1" />
        <rect x="9" y="2.6" width="3.4" height="10.8" rx="1" />
      </svg>
    )
  const flip = kind === 'prev'
  return (
    <svg width="13" height="11" viewBox="0 0 18 16" fill={f} style={{ transform: flip ? 'scaleX(-1)' : 'none' }}>
      <path d="M2 3 9 8l-7 5Z" />
      <path d="M8 3l7 5-7 5Z" />
      <rect x="15.4" y="3" width="1.8" height="10" rx="0.9" />
    </svg>
  )
}

function TinyPlay({ c }) {
  return (
    <svg width="7" height="7" viewBox="0 0 8 8" fill={c}>
      <path d="M0 0 8 4 0 8Z" />
    </svg>
  )
}

function TinyPause({ c }) {
  return (
    <svg width="7" height="7" viewBox="0 0 8 8" fill={c}>
      <rect x="0" y="0" width="3" height="8" />
      <rect x="5" y="0" width="3" height="8" />
    </svg>
  )
}

function Battery({ c }) {
  return (
    <svg width="18" height="9" viewBox="0 0 18 9" aria-hidden="true">
      <rect x="0.5" y="0.5" width="14" height="8" rx="1.4" fill="none" stroke={c} />
      <rect x="2" y="2" width="8" height="5" fill={c} />
      <rect x="15.4" y="3" width="2" height="3" rx="0.6" fill={c} />
    </svg>
  )
}

function clock(s) {
  const m = Math.floor(Math.max(s, 0) / 60)
  const r = Math.floor(Math.max(s, 0) % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}
