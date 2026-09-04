import { useCallback, useRef } from 'react'

/**
 * Arrastre con Pointer Events: funciona igual con ratón, dedo y lápiz.
 * Captura el puntero para que el arrastre no se pierda si el cursor
 * se sale del elemento, y escribe directamente sin re-render por frame
 * (el consumidor decide si guarda estado en cada move o sólo al soltar).
 */
export function usePointerDrag({ onStart, onMove, onEnd, disabled = false } = {}) {
  const state = useRef(null)

  const handleDown = useCallback(
    (e) => {
      if (disabled) return
      if (e.button !== undefined && e.button !== 0) return // sólo botón principal
      const origin = { x: e.clientX, y: e.clientY }
      state.current = { origin, ctx: onStart?.(e) ?? {} }

      const target = e.currentTarget
      target.setPointerCapture?.(e.pointerId)

      const move = (ev) => {
        if (!state.current) return
        onMove?.({
          dx: ev.clientX - state.current.origin.x,
          dy: ev.clientY - state.current.origin.y,
          x: ev.clientX,
          y: ev.clientY,
          ctx: state.current.ctx,
          event: ev,
        })
      }

      const up = (ev) => {
        target.releasePointerCapture?.(e.pointerId)
        target.removeEventListener('pointermove', move)
        target.removeEventListener('pointerup', up)
        target.removeEventListener('pointercancel', up)
        const s = state.current
        state.current = null
        if (s)
          onEnd?.({
            dx: ev.clientX - s.origin.x,
            dy: ev.clientY - s.origin.y,
            ctx: s.ctx,
            event: ev,
          })
      }

      target.addEventListener('pointermove', move)
      target.addEventListener('pointerup', up)
      target.addEventListener('pointercancel', up)
      e.preventDefault()
    },
    [onStart, onMove, onEnd, disabled]
  )

  return { onPointerDown: handleDown }
}
