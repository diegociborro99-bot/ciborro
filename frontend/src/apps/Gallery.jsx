import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Photo from '../components/Photo'
import { useCatZone } from '../lib/catZones'
import { useContent } from '../lib/content'
import { usePointerDrag } from '../hooks/usePointerDrag'
import { IconArrowLeft, IconArrowRight, IconClose } from '../icons/Icons'

/**
 * Galería: columnas tipo mampostería que se recomponen con el ancho real de
 * la ventana, filtros por año y lugar, y visor a pantalla completa con zoom,
 * arrastre, gestos y ficha de la foto.
 */
export default function Gallery({ dense, openIndex, onOpenIndex }) {
  const { photos } = useContent()
  const boxRef = useRef(null)
  const [width, setWidth] = useState(600)
  // las fotos no son sitio para que el gato se siente encima
  useCatZone(boxRef)
  const [year, setYear] = useState('todo')
  const [place, setPlace] = useState('todo')

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  const years = useMemo(() => ['todo', ...new Set(photos.map((p) => p.year))].sort().reverse(), [photos])
  const places = useMemo(() => ['todo', ...[...new Set(photos.map((p) => p.place))].sort()], [photos])

  const shown = useMemo(
    () => photos.filter((p) => (year === 'todo' || p.year === year) && (place === 'todo' || p.place === place)),
    [photos, year, place]
  )

  /* Índices (sobre `photos`) que el visor puede recorrer: los del filtro. Si la
     foto abierta no está en él —enlace profundo, o filtro cambiado con el visor
     abierto— se vuelve al archivo entero, que es mejor que dejarlo sin salida. */
  const ring = useMemo(() => {
    const idx = shown.map((ph) => photos.indexOf(ph))
    return openIndex !== null && !idx.includes(openIndex) ? photos.map((_, i) => i) : idx
  }, [shown, photos, openIndex])

  /* El escalonado de entrada es un gesto de bienvenida, y sólo tiene gracia la
     primera vez: al filtrar, retrasa hasta medio segundo unas fotos que ya
     estaban delante. Pasado el estreno, la rejilla se recompone y ya está. */
  const [entrada, setEntrada] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setEntrada(false), 1100)
    return () => clearTimeout(t)
  }, [])

  const target = dense ? 205 : 300
  const cols = Math.max(1, Math.min(4, Math.round(width / target) || 1))
  // ancho real de cada columna: así se pide la versión justa, ni un píxel más
  const colW = Math.max(120, Math.round((width - (cols - 1) * 10) / cols))

  // reparto por columnas equilibrando la altura estimada (ratio = alto/ancho)
  const columns = Array.from({ length: cols }, () => [])
  const heights = new Array(cols).fill(0)
  shown.forEach((p) => {
    const i = heights.indexOf(Math.min(...heights))
    columns[i].push(p)
    heights[i] += p.ratio
  })

  return (
    <>
      <div ref={boxRef} className="px-4 pt-4 pb-7 sm:px-5">
        <header className="mb-3 flex items-baseline justify-between gap-4">
          <h3 className="serif text-[26px]">Fotos</h3>
          <span className="label tnum">
            {shown.length === photos.length ? `${photos.length} imágenes` : `${shown.length} de ${photos.length}`}
          </span>
        </header>

        {/* filtros: los años caben como pastillas, los sitios van en una lista */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <Chips options={years} value={year} onChange={setYear} labelAll="Todo" />
          <span className="mx-1 h-3.5 w-px" style={{ background: 'var(--line-2)' }} />
          <Select
            options={places}
            value={place}
            onChange={setPlace}
            labelAll="Cualquier sitio"
            count={(o) => photos.filter((p) => p.place === o).length}
          />
          {(year !== 'todo' || place !== 'todo') && (
            <button
              type="button"
              onClick={() => {
                setYear('todo')
                setPlace('todo')
              }}
              className="ml-1 text-[11.5px] underline decoration-dotted underline-offset-4"
              style={{ color: 'var(--tx-3)' }}
            >
              quitar filtros
            </button>
          )}
        </div>

        {shown.length === 0 ? (
          <p className="py-14 text-center text-[13.5px]" style={{ color: 'var(--tx-3)' }}>
            Nada con ese filtro.
          </p>
        ) : (
          <div className="flex items-start gap-2.5">
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-1 flex-col gap-2.5">
                {col.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onOpenIndex(photos.indexOf(p))}
                    aria-label={`${p.title} — ${p.place}, ${p.year}`}
                    className={`group relative block w-full overflow-hidden rounded-[10px] text-left transition-[border-color] duration-300 ${entrada ? 'animate-in' : ''}`}
                    style={{
                      aspectRatio: `1 / ${p.ratio}`,
                      animationDelay: entrada ? `${Math.min((ci + i * cols) * 42, 520)}ms` : undefined,
                      border: '1px solid var(--line)',
                    }}
                  >
                    <Photo
                      photo={p}
                      className="absolute inset-0 h-full w-full"
                      sizes={`${colW}px`}
                      maxWidth={colW}
                      priority={ci + i * cols < 4}
                    />
                    <span
                      className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,.66), transparent 58%)' }}
                    />
                    <span className="absolute inset-x-0 bottom-0 translate-y-1.5 p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      <span className="block text-[12.5px] font-medium text-white">{p.title}</span>
                      <span className="block text-[11px] text-white/60">
                        {p.place} · {p.year}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {openIndex !== null && (
        <Lightbox photos={photos} ring={ring} index={openIndex} onIndex={onOpenIndex} onClose={() => onOpenIndex(null)} />
      )}
    </>
  )
}

function Chips({ options, value, onChange, labelAll }) {
  return (
    <>
      {options.map((o) => {
        const on = o === value
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className="rounded-full px-2.5 py-1 text-[11.5px] transition-colors duration-200"
            style={{
              background: on ? 'var(--accent-soft)' : 'transparent',
              color: on ? 'var(--accent)' : 'var(--tx-3)',
              border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
            }}
          >
            {o === 'todo' ? labelAll : o}
          </button>
        )
      })}
    </>
  )
}

/** Lista desplegable para filtros con muchas opciones. */
function Select({ options, value, onChange, labelAll, count }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    if (!open) return
    const away = (e) => !box.current?.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const on = value !== 'todo'

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full py-1 pr-2 pl-2.5 text-[11.5px] transition-colors duration-200"
        style={{
          background: on ? 'var(--accent-soft)' : 'transparent',
          color: on ? 'var(--accent)' : 'var(--tx-3)',
          border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
        }}
      >
        {on ? value : labelAll}
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" style={{ rotate: open ? '180deg' : '0deg', transition: 'rotate .2s var(--ease)' }}>
          <path d="m2.5 4.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className="pop-in scroll-thin absolute top-full left-0 z-30 mt-1.5 max-h-64 w-52 overflow-auto rounded-xl p-1.5"
          style={{ background: 'var(--panel)', border: '1px solid var(--line-2)', boxShadow: 'var(--shadow-pop)' }}
        >
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                onChange(o)
                setOpen(false)
              }}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors duration-150"
              style={{ background: o === value ? 'var(--accent-soft)' : 'transparent', color: 'var(--tx)' }}
              onMouseEnter={(e) => o !== value && (e.currentTarget.style.background = 'var(--line)')}
              onMouseLeave={(e) => o !== value && (e.currentTarget.style.background = 'transparent')}
            >
              {o === 'todo' ? labelAll : o}
              <span className="tnum text-[10.5px]" style={{ color: 'var(--tx-3)' }}>
                {o === 'todo' ? '' : count?.(o)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── visor ─────────────────────────────────────────────────────────── */

function Lightbox({ photos, ring, index, onIndex, onClose }) {
  const p = photos[index]
  const [zoom, setZoom] = useState(1)
  const boxRef = useRef(null)
  // el visor ocupa la pantalla: el gato se desvanece mientras esté abierto
  const portalRef = useRef(null)
  useCatZone(portalRef)
  const [ancho, setAncho] = useState(0)

  /* Zoom «de marco»: crece la caja entera, no la imagen recortada dentro de una
     caja fija. LLENAR es la escala a la que el marco toca los bordes de la
     pantalla; offsetWidth ignora los transforms, así que mide la caja en
     reposo aunque esté ampliada. */
  const llenar = () => {
    const el = boxRef.current
    if (!el) return 2
    const w = el.offsetWidth
    const h = el.offsetHeight
    return Math.max(1.05, Math.min(innerWidth / w, innerHeight / h) * 0.985)
  }
  const acotar = (z) => Math.min(llenar() * 2.5, Math.max(1, z))
  const inmersivo = zoom > 1.02

  /* Ampliada, la foto se centra en la PANTALLA, no en la franja que le dejan
     cabecera y miniaturas: si no, al llenar asomaba por arriba. Escalar desde el
     centro no mueve el centro, así que la medida vale a cualquier escala. */
  // estado y no ref: medido en un efecto, tiene que provocar el render que lo pinta
  const [centro, setCentro] = useState({ x: 0, y: 0 })
  useEffect(() => {
    if (!inmersivo) return
    const r = boxRef.current?.getBoundingClientRect()
    if (!r) return
    setCentro({ x: innerWidth / 2 - (r.left + r.width / 2), y: innerHeight / 2 - (r.top + r.height / 2) })
  }, [inmersivo])
  const desplaza = (px, py) => `${px + (inmersivo ? centro.x : 0)}px ${py + (inmersivo ? centro.y : 0)}px`
  // la misma en React y en el arrastre: si divergen, el zoom deja de animarse
  const TRANS = 'scale .35s var(--ease-out), translate .3s var(--ease-out)'

  // el ancho en reposo, para que `sizes` pida al navegador la variante justa
  useEffect(() => {
    setAncho(boxRef.current?.offsetWidth ?? 0)
  }, [index])

  /* Rueda del ratón sobre la foto: amplía o reduce. Se registra a mano con
     passive:false porque hay que impedir el scroll de la página, y React no
     garantiza que su onWheel lo permita. */
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      setZoom((z) => acotar(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [info, setInfo] = useState(true)
  const [auto, setAuto] = useState(false)

  const at = ring.indexOf(index)
  const go = (d) => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    onIndex(ring[(at + d + ring.length) % ring.length])
  }

  useEffect(() => {
    const key = (e) => {
      // con la foto ampliada, Esc primero la devuelve; el segundo cierra
      if (e.key === 'Escape') (zoom > 1 ? setZoom(1) : onClose())
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === '+' || e.key === '=') setZoom((z) => acotar(z * 1.4))
      else if (e.key === '-') setZoom((z) => acotar(z / 1.4))
      else if (e.key === '0') {
        setZoom(1)
        setPan({ x: 0, y: 0 })
      } else if (e.key.toLowerCase() === 'i') setInfo((v) => !v)
      else if (e.key === ' ') {
        // la chuleta de abajo lo promete desde siempre; hasta ahora no hacía nada
        e.preventDefault()
        setAuto((v) => !v)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, zoom])

  useEffect(() => {
    if (zoom === 1) setPan({ x: 0, y: 0 })
  }, [zoom])


  // pase de diapositivas; cualquier zoom lo detiene, para no marear
  useEffect(() => {
    if (!auto) return
    if (zoom > 1) return setAuto(false)
    const id = setInterval(() => go(1), 4500)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, zoom, index])

  // arrastre: desplaza si hay zoom, y si no, cambia de foto al soltar
  const drag = usePointerDrag({
    onStart: (e) => {
      const el = e.currentTarget
      el.style.transition = 'none'
      return { pan, moved: 0, el }
    },
    onMove: ({ dx, dy, ctx }) => {
      ctx.moved = Math.max(ctx.moved, Math.abs(dx), Math.abs(dy))
      // con zoom, desplazar: pintado sobre el nodo y confirmado al soltar
      if (zoom > 1) return (ctx.el.style.translate = desplaza(ctx.pan.x + dx, ctx.pan.y + dy))
      /* Sin zoom, la foto sigue al dedo a media velocidad mientras arrastras: el
         gesto lateral funcionaba, pero no acusaba recibo hasta que la foto ya
         había cambiado, y se sentía como si no hubiera pasado nada. Se pinta
         sobre el nodo, sin re-render por fotograma, como en las ventanas. */
      ctx.el.style.translate = `${dx * 0.45}px 0`
    },
    onEnd: ({ dx, dy, ctx }) => {
      ctx.el.style.transition = TRANS
      if (zoom > 1 && ctx.moved >= 4) {
        // confirmar el desplazamiento; React pintará lo mismo que ya hay
        return setPan({ x: ctx.pan.x + dx, y: ctx.pan.y + dy })
      }
      // vuelve sola a su sitio: si hay cambio de foto, la nueva entra desde cero
      ctx.el.style.translate = desplaza(0, 0)
      if (zoom === 1 && Math.abs(dx) > 70) go(dx < 0 ? 1 : -1)
      // un clic lleva el marco a llenar la pantalla; otro lo devuelve
      else if (ctx.moved < 4) setZoom((z) => (z > 1 ? 1 : llenar()))
    },
  })

  // la siguiente y la anterior, ya descargándose: con fotos de 4K, la
  // diferencia entre pasar de una a otra al instante o esperar es esto. Se
  // pintan de verdad (1 px, invisibles) para que el navegador negocie formato
  // y ancho igual que en el visor y acabe pidiendo exactamente la misma URL.
  const vecinas = [1, -1].map((d) => photos[ring[(at + d + ring.length) % ring.length]]).filter(Boolean)

  return createPortal(
    <div
      // el visor es negro pase lo que pase: se declara oscuro y sus tokens
      // dejan de bailar con el tema del escritorio
      data-theme="dark"
      ref={portalRef}
      className="fade-in fixed inset-0 z-[9500] flex flex-col"
      style={{
        background: 'color-mix(in srgb, var(--bg-deep) 95%, transparent)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div aria-hidden className="pointer-events-none fixed h-px w-px overflow-hidden opacity-0">
        {vecinas.map((n) => (
          <Photo key={n.id} photo={n} eager sizes="(max-width: 800px) 96vw, min(90vw, 1600px)" />
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
        <span className="tnum text-[12px] text-white/45">
          {String(at + 1).padStart(2, '0')} / {String(ring.length).padStart(2, '0')}
        </span>
        <div className="flex items-center gap-1">
          <Round onClick={() => setZoom((z) => acotar(z / 1.4))} label="Alejar" disabled={zoom <= 1}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="6.6" />
              <path d="m16 16 4.4 4.4M8.4 11h5.2" strokeLinecap="round" />
            </svg>
          </Round>
          <span className="tnum hidden w-11 text-center text-[11.5px] text-white/45 sm:block">{Math.round(zoom * 100)}%</span>
          <Round onClick={() => setZoom((z) => acotar(z * 1.4))} label="Acercar" disabled={zoom >= llenar() * 2.5 - 0.01}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="6.6" />
              <path d="m16 16 4.4 4.4M8.4 11h5.2M11 8.4v5.2" strokeLinecap="round" />
            </svg>
          </Round>
          <Round onClick={() => setAuto((v) => !v)} label={auto ? 'Parar el pase' : 'Pase de diapositivas'}>
            {auto ? (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3.4" y="2.6" width="3.4" height="10.8" rx="1" />
                <rect x="9.2" y="2.6" width="3.4" height="10.8" rx="1" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2.6 13.4 8 4 13.4Z" />
              </svg>
            )}
          </Round>
          <Round onClick={() => setInfo((v) => !v)} label="Ficha de la foto">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="8.6" />
              <path d="M12 11v5.4M12 7.8v.02" strokeLinecap="round" />
            </svg>
          </Round>
          <Round onClick={onClose} label="Cerrar">
            <IconClose size={16} />
          </Round>
        </div>
      </div>

      {auto && (
        <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden">
          <style>{`@keyframes slideBar{from{scale:0 1}to{scale:1 1}}`}</style>
          <div
            key={index}
            className="h-full"
            style={{ background: 'var(--accent)', transformOrigin: 'left', animation: 'slideBar 4.5s linear' }}
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1 items-center gap-1 px-2 sm:px-4">
        <div style={{ opacity: inmersivo ? 0 : 1, pointerEvents: inmersivo ? 'none' : undefined, transition: 'opacity .3s var(--ease)' }}>
          <Arrow dir="left" onClick={() => go(-1)} />
        </div>
        <figure key={p.id} className="fade-in flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
          <div
            {...drag}
            ref={boxRef}
            className="rounded-lg touch-none"
            style={{
              /* Alto = lo que deje la ventana, pero nunca más de lo que permite
                 el ancho disponible al ratio de la foto. Los 240 son cabecera,
                 ficha, tira de miniaturas y chuleta; los 128, las dos flechas de
                 44 más aire. Antes un maxWidth de 90vw mandaba sobre el
                 aspect-ratio y el <img> recortaba: cinco de las doce fotos se
                 veían al 61 % en móvil, y en 1080p la foto se clavaba en 600 px
                 sobrando 860. */
              height: `max(120px, min(calc(100svh - 240px), calc((100vw - 128px) * ${p.ratio})))`,
              aspectRatio: `1 / ${p.ratio}`,
              cursor: zoom > 1 ? 'grab' : 'zoom-in',
              boxShadow: '0 30px 80px -30px rgba(0,0,0,.9)',
              /* La escala y el desplazamiento van en la caja: crece el marco
                 entero y la foto nunca se recorta. `translate` se aplica en el
                 espacio del padre, en píxeles de pantalla, así que el arrastre
                 no hay que corregirlo por el zoom. Por encima de las flechas y
                 el cromo, que al ampliar se apartan. */
              scale: String(zoom),
              translate: desplaza(pan.x, pan.y),
              transformOrigin: 'center',
              transition: TRANS,
              position: 'relative',
              zIndex: inmersivo ? 5 : undefined,
            }}
          >
            <Photo
              photo={p}
              priority
              /* con el ancho real en píxeles, y multiplicado por el zoom, el
                 navegador coge la variante que hace falta para verse nítida
                 ampliada: el zoom enseña detalle, no píxeles */
              sizes={ancho ? `${Math.round(ancho * zoom)}px` : '(max-width: 800px) 96vw, min(90vw, 1600px)'}
              className="h-full w-full rounded-lg"
            />
          </div>

          <figcaption className="text-center" style={{ opacity: inmersivo ? 0 : 1, pointerEvents: inmersivo ? 'none' : undefined, transition: 'opacity .3s var(--ease)' }}>
            <p className="serif text-[21px] text-white">{p.title}</p>
            {info && (
              <p className="fade-in tnum mt-1 flex items-center justify-center gap-2 text-[11.5px] text-white/45">
                <span>{p.place}</span>
                <span className="h-2.5 w-px bg-white/20" />
                <span>{p.year}</span>
                <span className="h-2.5 w-px bg-white/20" />
                <span>{p.ratio >= 1.05 ? 'vertical' : p.ratio <= 0.95 ? 'apaisada' : 'cuadrada'}</span>
              </p>
            )}
          </figcaption>
        </figure>
        <div style={{ opacity: inmersivo ? 0 : 1, pointerEvents: inmersivo ? 'none' : undefined, transition: 'opacity .3s var(--ease)' }}>
          <Arrow dir="right" onClick={() => go(1)} />
        </div>
      </div>

      <div
        className="scroll-thin flex shrink-0 justify-start gap-1.5 overflow-x-auto px-4 py-4 sm:justify-center"
        style={{ opacity: inmersivo ? 0 : 1, pointerEvents: inmersivo ? 'none' : undefined, transition: 'opacity .3s var(--ease)' }}
      >
        {ring.map((i) => photos[i]).map((t, n) => {
          const i = ring[n]
          return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setZoom(1)
              onIndex(i)
            }}
            aria-label={t.title}
            className="h-11 w-11 shrink-0 overflow-hidden rounded-md transition-all duration-200"
            style={{
              opacity: i === index ? 1 : 0.38,
              outline: i === index ? '1.5px solid var(--accent)' : 'none',
              outlineOffset: 2,
            }}
          >
            <Photo photo={t} className="h-full w-full" sizes="44px" maxWidth={44} />
          </button>
          )
        })}
      </div>

      <p
        className="hidden pb-3 text-center text-[10.5px] sm:block"
        style={{ color: 'var(--tx-2)', opacity: inmersivo ? 0 : 1, transition: 'opacity .3s var(--ease)' }}
      >
        ← → cambiar · clic o rueda: ampliar · + − 0 · I ficha · espacio pase · Esc salir
      </p>
    </div>,
    document.body
  )
}

function Round({ onClick, label, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-11 w-11 place-items-center rounded-full text-white/60 transition-all duration-200 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25 sm:h-8 sm:w-8"
    >
      {children}
    </button>
  )
}

function Arrow({ dir, onClick }) {
  const I = dir === 'left' ? IconArrowLeft : IconArrowRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 'left' ? 'Anterior' : 'Siguiente'}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/55 transition-all duration-200 hover:scale-105 hover:bg-white/10 hover:text-white"
    >
      <I size={19} />
    </button>
  )
}
