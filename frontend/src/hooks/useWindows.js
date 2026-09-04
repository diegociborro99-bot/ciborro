import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Gestor de ventanas: apertura, foco, minimizado, maximizado, cierre,
 * movimiento, redimensionado por cualquier borde, anclaje a los lados y
 * memoria de la posición entre visitas. Sin dependencias.
 */

export const MENUBAR_H = 34
export const DOCK_H = 96
const STORE = 'win-layout-v2'

function bounds() {
  return {
    vw: window.innerWidth,
    vh: window.innerHeight,
    top: MENUBAR_H + 6,
    bottom: window.innerHeight - 8,
  }
}

function clampToViewport(win) {
  const { vw, vh } = bounds()
  const w = Math.max(win.minW, Math.min(win.w, vw - 16))
  const h = Math.max(win.minH, Math.min(win.h, vh - MENUBAR_H - 16))
  return {
    ...win,
    w,
    h,
    // siempre queda barra de título alcanzable dentro de la pantalla
    x: Math.min(Math.max(win.x, -w + 110), vw - 110),
    y: Math.min(Math.max(win.y, MENUBAR_H + 2), vh - 44),
  }
}

/** Zona de anclaje según dónde se suelte la ventana. */
export function snapZone(x, y) {
  const { vw } = bounds()
  if (y < MENUBAR_H + 8) return 'top'
  if (x < 12) return 'left'
  if (x > vw - 12) return 'right'
  return null
}

export function snapRect(zone) {
  const { vw, vh, top } = bounds()
  const h = vh - top - DOCK_H
  if (zone === 'top') return { x: 8, y: top, w: vw - 16, h }
  if (zone === 'left') return { x: 8, y: top, w: vw / 2 - 12, h }
  if (zone === 'right') return { x: vw / 2 + 4, y: top, w: vw / 2 - 12, h }
  return null
}

export function useWindows(defs, initiallyOpen = []) {
  const saved = useRef(readStore())

  const [wins, setWins] = useState(() =>
    initiallyOpen.map((id, i) => spawn(defs[id], id, i, i + 1, saved.current[id]))
  )
  const [topZ, setTopZ] = useState(initiallyOpen.length + 1)

  // guarda la disposición para la próxima visita
  useEffect(() => {
    const layout = {}
    for (const w of wins) layout[w.id] = { x: w.x, y: w.y, w: w.w, h: w.h }
    try {
      localStorage.setItem(STORE, JSON.stringify({ ...saved.current, ...layout }))
    } catch {
      /* modo privado: da igual */
    }
  }, [wins])

  // recolocar al cambiar el tamaño de la ventana del navegador
  useEffect(() => {
    const onResize = () => setWins((ws) => ws.map((w) => (w.maximized ? maximize(w) : clampToViewport(w))))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const focus = useCallback((id) => {
    setTopZ((z) => {
      const next = z + 1
      setWins((ws) => ws.map((w) => (w.id === id ? { ...w, z: next, minimized: false } : w)))
      return next
    })
  }, [])

  const open = useCallback(
    (id) => {
      setWins((ws) => {
        if (ws.some((w) => w.id === id)) return ws
        return [...ws, spawn(defs[id], id, ws.length, topZ + 1, saved.current[id])]
      })
      focus(id)
    },
    [defs, topZ, focus]
  )

  const close = useCallback((id) => {
    setWins((ws) => ws.map((w) => (w.id === id ? { ...w, closing: true } : w)))
    setTimeout(() => setWins((ws) => ws.filter((w) => w.id !== id)), 170)
  }, [])

  const closeAll = useCallback(() => {
    setWins((ws) => ws.map((w) => ({ ...w, closing: true })))
    setTimeout(() => setWins([]), 170)
  }, [])

  // se encoge hacia el dock antes de desaparecer
  const minimize = useCallback((id) => {
    setWins((ws) => ws.map((w) => (w.id === id ? { ...w, minimizing: true } : w)))
    setTimeout(
      () => setWins((ws) => ws.map((w) => (w.id === id ? { ...w, minimizing: false, minimized: true } : w))),
      210
    )
  }, [])

  const toggleMaximize = useCallback((id) => {
    setWins((ws) =>
      ws.map((w) => {
        if (w.id !== id) return w
        if (w.maximized) return clampToViewport({ ...w, maximized: false, ...w.restore })
        return maximize(w)
      })
    )
  }, [])

  const setGeometry = useCallback((id, geo) => {
    setWins((ws) => ws.map((w) => (w.id === id ? clampToViewport({ ...w, ...geo }) : w)))
  }, [])

  /** Ancla la ventana a un lado, guardando su tamaño anterior. */
  const snap = useCallback((id, zone) => {
    const rect = snapRect(zone)
    if (!rect) return
    setWins((ws) =>
      ws.map((w) =>
        w.id === id
          ? { ...w, ...rect, maximized: zone === 'top', restore: w.restore ?? { x: w.x, y: w.y, w: w.w, h: w.h } }
          : w
      )
    )
  }, [])

  const toggle = useCallback(
    (id) => {
      setWins((ws) => {
        const w = ws.find((x) => x.id === id)
        if (!w) {
          setTimeout(() => open(id), 0)
          return ws
        }
        if (w.minimized) {
          setTimeout(() => focus(id), 0)
          return ws
        }
        // si ya está delante, la esconde; si está detrás, la trae al frente
        const front = ws.filter((x) => !x.minimized).sort((a, b) => b.z - a.z)[0]
        if (front?.id === id) return ws.map((x) => (x.id === id ? { ...x, minimized: true } : x))
        setTimeout(() => focus(id), 0)
        return ws
      })
    },
    [open, focus]
  )

  return { wins, open, close, closeAll, focus, minimize, toggleMaximize, setGeometry, snap, toggle }
}

/* ── auxiliares ─────────────────────────────────────────────────────── */

function maximize(w) {
  const rect = snapRect('top')
  return { ...w, maximized: true, restore: w.restore ?? { x: w.x, y: w.y, w: w.w, h: w.h }, ...rect }
}

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}')
  } catch {
    return {}
  }
}

function spawn(def, id, index, z, remembered) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const compact = vw < 780

  const base = {
    id,
    title: def.title,
    z,
    minimized: false,
    minimizing: false,
    maximized: false,
    closing: false,
    restore: null,
    resizable: def.resizable !== false,
    minW: def.minW ?? 300,
    minH: def.minH ?? 220,
  }

  if (compact) {
    return clampToViewport({
      ...base,
      w: vw - 20,
      h: vh - MENUBAR_H - DOCK_H - 18,
      x: 10,
      y: MENUBAR_H + 10,
    })
  }

  if (remembered) return clampToViewport({ ...base, ...remembered })

  const bx = def.x != null ? (def.x < 1 ? def.x * vw : def.x) : vw * 0.18
  const by = def.y != null ? (def.y < 1 ? def.y * vh : def.y) : MENUBAR_H + 40

  return clampToViewport({
    ...base,
    w: def.w,
    h: def.h,
    x: bx + index * 26,
    y: by + index * 22,
  })
}
