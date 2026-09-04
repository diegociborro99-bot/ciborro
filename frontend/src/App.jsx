import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import MenuBar from './components/MenuBar'
import Dock from './components/Dock'
import Window from './components/Window'
import Cat from './components/Cat'
import Handwriting from './components/Handwriting'
import Wallpaper from './components/Wallpaper'
import Boot from './components/Boot'
import ContextMenu from './components/ContextMenu'
import CommandPalette from './components/CommandPalette'
import Toasts, { useToasts } from './components/Toasts'
import Shortcuts from './components/Shortcuts'

import Gallery from './apps/Gallery'
import About from './apps/About'
import Projects from './apps/Projects'
import Player from './apps/Player'
import HerdGame from './apps/HerdGame'
import Notes from './apps/Notes'
import Terminal from './apps/Terminal'

import { useWindows, snapRect, DOCK_H, MENUBAR_H } from './hooks/useWindows'
import { useContent } from './lib/content'
import {
  IconGallery,
  IconAbout,
  IconProjects,
  IconMusic,
  IconGame,
  IconNotes,
  IconTerminal,
  IconSearch,
  IconGrid,
  IconRows,
  IconSun,
  IconMoon,
} from './icons/Icons'

/* Definición de las apps: geometría inicial, icono y título. */
const APPS = {
  gallery:  { title: 'Fotos',                icon: IconGallery,  w: 640, h: 570, x: 0.13, y: 88,  minW: 320, minH: 300 },
  about:    { title: 'Sobre mí',             icon: IconAbout,    w: 560, h: 480, x: 0.45, y: 132, minW: 340, minH: 280 },
  projects: { title: 'Otras cosas',          icon: IconProjects, w: 600, h: 430, x: 0.30, y: 320, minW: 360, minH: 240 },
  music:    { title: 'Música',               icon: IconMusic,    w: 318, h: 522, x: 0.72, y: 84,  minW: 300, minH: 500 },
  game:     { title: 'Pastorea a los gatos', icon: IconGame,     w: 540, h: 450, x: 0.34, y: 160, minW: 380, minH: 320 },
  terminal: { title: 'Consola',              icon: IconTerminal, w: 560, h: 400, x: 0.24, y: 380, minW: 340, minH: 220 },
  notes:    { title: 'Léeme',                icon: IconNotes,    w: 520, h: 510, x: 0.50, y: 120, minW: 340, minH: 280 },
}

const ORDER = ['gallery', 'about', 'projects', 'music', 'game', 'terminal', 'notes']

/** Nombres para la URL, para poder enlazar una foto o una app concreta. */
const SLUG = {
  gallery: 'fotos',
  about: 'sobre-mi',
  projects: 'otras-cosas',
  music: 'musica',
  game: 'gatos',
  terminal: 'consola',
  notes: 'leeme',
}
const UNSLUG = Object.fromEntries(Object.entries(SLUG).map(([k, v]) => [v, k]))

export default function App() {
  const { owner, photos, projects } = useContent()
  const [theme, setTheme] = useState(
    () =>
      localStorage.getItem('theme') ??
      (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  )
  const [dense, setDense] = useState(true)
  const [cat, setCat] = useState(() => localStorage.getItem('cat') !== 'off')
  const [booting, setBooting] = useState(true)
  const [palette, setPalette] = useState(false)
  const [ctx, setCtx] = useState(null)
  const [photoIndex, setPhotoIndex] = useState(null)
  const [snapHint, setSnapHint] = useState(null)
  const [expose, setExpose] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [nowPlaying, setNowPlaying] = useState(null)

  const { items: toastItems, toast } = useToasts()
  const dockRef = useRef({})

  const { wins, open, close, closeAll, focus, minimize, toggleMaximize, setGeometry, snap, toggle } = useWindows(
    APPS,
    window.innerWidth < 780 ? ['gallery'] : ['gallery', 'about']
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
    // el cromo del navegador va con el tema elegido, no con el del sistema, y
    // el color sale del token para no tener el mismo valor escrito en dos sitios
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  }, [theme])

  useEffect(() => {
    localStorage.setItem('cat', cat ? 'on' : 'off')
  }, [cat])

  const topWin = useMemo(() => wins.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0], [wins])
  // lienzo desnudo: nada abierto, ni siquiera minimizado en el dock
  const bare = !topWin

  /* — abrir una foto desde cualquier sitio — */
  const openPhoto = useCallback(
    (i) => {
      open('gallery')
      setPhotoIndex(i)
    },
    [open]
  )

  /* — enlaces profundos —
     La URL refleja lo que tienes delante: #fotos/5 abre el visor en esa foto y
     #consola abre la consola, así que un enlace lleva justo a donde quieres. */
  useEffect(() => {
    const hash = decodeURIComponent(location.hash.replace(/^#\/?/, ''))
    if (!hash) return
    const [name, n] = hash.split('/')
    const id = UNSLUG[name]
    if (!id) return
    open(id)
    if (id === 'gallery' && n) {
      const i = Number(n) - 1
      if (i >= 0 && i < photos.length) setPhotoIndex(i)
    }
    // sólo al arrancar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const next =
      photoIndex !== null
        ? `#fotos/${photoIndex + 1}`
        : topWin
          ? `#${SLUG[topWin.id]}`
          : ' '
    if (location.hash !== next) history.replaceState(null, '', next === ' ' ? location.pathname : next)
  }, [topWin, photoIndex])

  /* — atajos de teclado — */
  useEffect(() => {
    const key = (e) => {
      const typing = ['INPUT', 'TEXTAREA'].includes(e.target.tagName)

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((v) => !v)
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'w' && topWin) {
        e.preventDefault()
        close(topWin.id)
        return
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === 'Escape') {
        setExpose(false)
        setSheet(false)
        return
      }
      if (e.key === '?') {
        e.preventDefault()
        setSheet((v) => !v)
        return
      }
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setExpose((v) => !v)
        return
      }

      const n = Number(e.key)
      if (n >= 1 && n <= ORDER.length) toggle(ORDER[n - 1])
      else if (e.key === '/') {
        e.preventDefault()
        setPalette(true)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [toggle, topWin, close])

  /* — menús de la barra superior — */
  const flipTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      toast(next === 'dark' ? 'Tema oscuro' : 'Tema claro')
      return next
    })
  }, [toast])

  const flipCat = useCallback(() => {
    setCat((c) => {
      toast(c ? 'El gato se ha ido a dormir' : 'Ahí va el gato')
      return !c
    })
  }, [toast])

  const menus = useMemo(
    () => [
      {
        label: 'Escritorio',
        items: [
          { label: 'Sobre mí', action: () => open('about') },
          { label: 'Buscar…', hint: '⌘K', action: () => setPalette(true) },
          { sep: true },
          { label: 'Léeme', action: () => open('notes') },
          { label: 'Cerrar todo', action: closeAll },
        ],
      },
      {
        label: 'Ver',
        items: [
          { label: 'Ver todas las ventanas', hint: 'F', action: () => setExpose(true) },
          { sep: true },
          { label: dense ? 'Galería más grande' : 'Galería más densa', action: () => setDense((d) => !d) },
          { label: theme === 'dark' ? 'Tema claro' : 'Tema oscuro', action: flipTheme },
          { sep: true },
          { label: cat ? 'Guardar el gato' : 'Sacar el gato', action: flipCat },
          { label: 'Atajos de teclado', hint: '?', action: () => setSheet(true) },
        ],
      },
      {
        label: 'Ir a',
        items: ORDER.map((id, i) => ({ label: APPS[id].title, hint: String(i + 1), action: () => open(id) })),
      },
    ],
    [open, closeAll, dense, theme, cat, flipTheme, flipCat]
  )

  /* — buscador — */
  const commands = useMemo(() => {
    const list = ORDER.map((id, i) => ({
      id: `app-${id}`,
      group: 'App',
      label: APPS[id].title,
      sub: `Abrir · tecla ${i + 1}`,
      icon: APPS[id].icon,
      weight: 50 - i,
      run: () => open(id),
    }))

    for (const p of photos) {
      list.push({
        id: `photo-${p.id}`,
        group: 'Foto',
        label: p.title,
        sub: `${p.place} · ${p.year}`,
        keywords: `${p.place} ${p.year} foto imagen`,
        icon: IconGallery,
        run: () => openPhoto(photos.indexOf(p)),
      })
    }

    for (const pr of projects) {
      list.push({
        id: `proj-${pr.id}`,
        group: 'Proyecto',
        label: pr.title,
        sub: `${pr.kind} · ${pr.year}`,
        keywords: pr.blurb,
        icon: IconProjects,
        run: () => (pr.href ? window.open(pr.href, '_blank', 'noreferrer') : open('projects')),
      })
    }

    list.push(
      {
        id: 'act-theme',
        group: 'Acción',
        label: theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
        keywords: 'tema color claro oscuro',
        icon: theme === 'dark' ? IconSun : IconMoon,
        run: flipTheme,
      },
      {
        id: 'act-cat',
        group: 'Acción',
        label: cat ? 'Guardar el gato' : 'Sacar el gato',
        keywords: 'gato neko mascota',
        icon: IconGame,
        run: flipCat,
      },
      {
        id: 'act-dense',
        group: 'Acción',
        label: dense ? 'Galería más grande' : 'Galería más densa',
        keywords: 'columnas galeria tamaño',
        icon: dense ? IconRows : IconGrid,
        run: () => setDense((d) => !d),
      },
      {
        id: 'act-close',
        group: 'Acción',
        label: 'Cerrar todas las ventanas',
        keywords: 'cerrar limpiar escritorio',
        icon: IconNotes,
        run: closeAll,
      }
    )

    for (const l of owner.links) {
      list.push({
        id: `link-${l.label}`,
        group: 'Enlace',
        label: l.label,
        sub: l.href.replace(/^mailto:|^https?:\/\//, ''),
        icon: IconAbout,
        run: () => window.open(l.href, '_blank', 'noreferrer'),
      })
    }

    return list
  }, [open, openPhoto, theme, cat, dense, flipTheme, flipCat, closeAll, owner, photos, projects])

  /* — menú contextual del escritorio — */
  const ctxItems = useMemo(
    () => [
      { label: 'Buscar…', hint: '⌘K', action: () => setPalette(true) },
      { label: 'Abrir las fotos', hint: '1', action: () => open('gallery') },
      { label: 'Abrir la consola', hint: '6', action: () => open('terminal') },
      { label: 'Ver todas las ventanas', hint: 'F', action: () => setExpose(true) },
      { sep: true },
      { label: theme === 'dark' ? 'Tema claro' : 'Tema oscuro', action: flipTheme },
      { label: cat ? 'Guardar el gato' : 'Sacar el gato', action: flipCat },
      { sep: true },
      { label: 'Cerrar todas las ventanas', action: closeAll },
    ],
    [open, theme, cat, flipTheme, flipCat, closeAll]
  )

  const dockItems = ORDER.map((id) => ({ id, title: APPS[id].title, icon: APPS[id].icon }))
  const hintRect = snapHint ? snapRect(snapHint) : null

  /* — vista general de ventanas —
     No se les cambia el tamaño (eso recompondría el contenido y chocaría con
     los mínimos de cada app): se calcula una celda por ventana y se colocan
     escaladas dentro. Al salir, cada una vuelve exactamente a donde estaba. */
  const slots = useMemo(() => {
    if (!expose) return null
    const open = wins.filter((w) => !w.closing)
    if (!open.length) return {}
    const cols = Math.ceil(Math.sqrt(open.length))
    const rows = Math.ceil(open.length / cols)
    const pad = 26
    const gap = 20
    const top = 44
    const areaW = window.innerWidth - pad * 2
    const areaH = window.innerHeight - top - DOCK_H - pad
    const cw = (areaW - gap * (cols - 1)) / cols
    const ch = (areaH - gap * (rows - 1)) / rows

    const out = {}
    open.forEach((w, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const scale = Math.min(cw / w.w, ch / w.h, 1)
      const cx = pad + col * (cw + gap) + (cw - w.w * scale) / 2
      const cy = top + row * (ch + gap) + (ch - w.h * scale) / 2
      out[w.id] = { x: cx, y: cy, scale }
    })
    return out
  }, [expose, wins])

  const pickFromExpose = useCallback(
    (id) => {
      setExpose(false)
      if (id) focus(id)
    },
    [focus]
  )

  const sys = useMemo(
    () => ({ open, openPhoto, setTheme, theme, setCat, catOn: cat, toast }),
    [open, openPhoto, theme, cat, toast]
  )

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: 'var(--bg)' }}
      onContextMenu={(e) => {
        if (e.target.closest('[role="dialog"], header, nav')) return
        e.preventDefault()
        setCtx({ x: e.clientX, y: e.clientY })
      }}
    >
      <Wallpaper />

      {/* Firma de fondo. Con todo cerrado sube de tono y aparece debajo la única
          línea que nombra al dock: sin iconos sueltos, el lienzo desnudo tiene
          que decir de dónde salen las cosas. El desplazamiento centra el bloque
          en la franja real entre la barra y el dock, no en la ventana. */}
      <div
        className="pointer-events-none absolute inset-0 grid place-items-center px-6"
        style={{ paddingBottom: DOCK_H - MENUBAR_H }}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div style={{ opacity: booting ? 0 : bare ? 0.4 : 0.13, transition: 'opacity .9s var(--ease) .2s' }}>
            <Handwriting text={owner.greeting} height={112} color="var(--tx)" strokeWidth={8} delay={0.6} />
          </div>
          <p
            className="label"
            style={{
              color: 'var(--tx-2)',
              textShadow: '0 1px 3px var(--halo)',
              opacity: booting || !bare ? 0 : 0.9,
              transition: 'opacity .5s var(--ease)',
            }}
          >
            todo se abre desde el dock
          </p>
        </div>
      </div>

      <MenuBar
        menus={menus}
        theme={theme}
        onToggleTheme={flipTheme}
        onSearch={() => setPalette(true)}
        nowPlaying={nowPlaying}
        onNowPlaying={() => open('music')}
      />

      {/* guía de anclaje mientras se arrastra hacia un borde */}
      {hintRect && (
        <div
          className="fade-in pointer-events-none fixed z-[6000] rounded-xl"
          style={{
            left: hintRect.x,
            top: hintRect.y,
            width: hintRect.w,
            height: hintRect.h,
            background: 'var(--accent-soft)',
            border: '1.5px solid var(--accent)',
          }}
        />
      )}

      {/* telón de la vista general: por debajo de las ventanas, clic para salir */}
      {expose && (
        <button
          type="button"
          aria-label="Salir de la vista de ventanas"
          onClick={() => setExpose(false)}
          className="fade-in fixed inset-0 z-[500] cursor-default"
          style={{ background: 'color-mix(in srgb, var(--bg-deep) 66%, transparent)', backdropFilter: 'blur(3px)' }}
        />
      )}

      {wins.map((w) => (
        <Window
          key={w.id}
          win={w}
          active={topWin?.id === w.id}
          onFocus={() => focus(w.id)}
          onClose={() => close(w.id)}
          onMinimize={() => minimize(w.id)}
          onToggleMaximize={() => toggleMaximize(w.id)}
          onGeometry={(g) => setGeometry(w.id, g)}
          onSnapHint={setSnapHint}
          onSnap={(zone) => snap(w.id, zone)}
          minimizeTo={dockPoint(dockRef, w.id)}
          exposeSlot={slots?.[w.id] ?? null}
          onPick={() => pickFromExpose(w.id)}
          toolbar={
            w.id === 'gallery' ? (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setDense((d) => !d)}
                aria-label="Cambiar densidad de la galería"
                title="Cambiar densidad"
                className="grid h-6 w-6 place-items-center rounded-md transition-colors duration-200"
                style={{ color: 'var(--tx-3)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--line)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {dense ? <IconRows size={14} /> : <IconGrid size={14} />}
              </button>
            ) : null
          }
        >
          {w.id === 'gallery' && <Gallery dense={dense} openIndex={photoIndex} onOpenIndex={setPhotoIndex} />}
          {w.id === 'about' && <About />}
          {w.id === 'projects' && <Projects />}
          {w.id === 'music' && <Player onNowPlaying={setNowPlaying} />}
          {w.id === 'game' && <HerdGame />}
          {w.id === 'terminal' && <Terminal sys={sys} />}
          {w.id === 'notes' && <Notes />}
        </Window>
      ))}

      <Dock
        items={dockItems}
        openIds={wins.filter((w) => !w.minimized).map((w) => w.id)}
        minimizedIds={wins.filter((w) => w.minimized).map((w) => w.id)}
        activeId={topWin?.id}
        onLaunch={toggle}
        registerRef={(id, el) => (dockRef.current[id] = el)}
        extra={
          <button
            type="button"
            onClick={() => setPalette(true)}
            title="Buscar  ⌘K"
            aria-label="Buscar"
            className="grid h-8 w-8 place-items-center rounded-[13px] transition-colors duration-200 sm:h-10 sm:w-10"
            style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', color: 'var(--tx-2)' }}
          >
            <IconSearch size={18} />
          </button>
        }
      />

      {/* también en táctil: allí el gato va hacia donde toques, y algo más
          rápido, porque un toque puede mandarlo al otro extremo de la pantalla */}
      <Cat enabled={cat && !booting} speed={matchMedia('(pointer: coarse)').matches ? 145 : 75} />

      <CommandPalette open={palette} onClose={() => setPalette(false)} commands={commands} />
      {ctx && <ContextMenu at={ctx} items={ctxItems} onClose={() => setCtx(null)} />}
      <Shortcuts open={sheet} onClose={() => setSheet(false)} apps={ORDER.map((id) => APPS[id].title)} />
      <Toasts items={toastItems} />
      <Boot onDone={() => setBooting(false)} />
    </div>
  )
}

/** Centro del icono del dock, para que la ventana se encoja hacia él. */
function dockPoint(ref, id) {
  const el = ref.current?.[id]
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight - DOCK_H / 2 }
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
