import { useEffect, useState } from 'react'
import Handwriting from './Handwriting'
import { useContent } from '../lib/content'

/**
 * Arranque: la firma se escribe sola sobre negro mientras una línea fina
 * se llena, y el escritorio aparece por detrás. Se salta con cualquier
 * tecla o clic, y sólo ocurre una vez por sesión del navegador.
 */
export default function Boot({ onDone }) {
  const { owner } = useContent()
  const [show, setShow] = useState(() => {
    try {
      return sessionStorage.getItem('booted') !== '1'
    } catch {
      return true
    }
  })
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!show) {
      onDone?.()
      return
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const total = reduced ? 400 : 3100

    const finish = () => {
      setLeaving(true)
      try {
        sessionStorage.setItem('booted', '1')
      } catch {
        /* modo privado */
      }
      setTimeout(() => {
        setShow(false)
        onDone?.()
      }, 620)
    }

    const t = setTimeout(finish, total)
    const skip = () => finish()
    window.addEventListener('keydown', skip, { once: true })
    window.addEventListener('pointerdown', skip, { once: true })
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
    }
  }, [show, onDone])

  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-[9800] grid place-items-center"
      style={{
        background: 'var(--bg-deep)',
        opacity: leaving ? 0 : 1,
        transition: 'opacity .6s var(--ease)',
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      <div className="flex flex-col items-center gap-7 px-8">
        <Handwriting text={owner.greeting} height={104} color="var(--accent)" strokeWidth={8} duration={2.1} />

        <div className="h-px w-40 overflow-hidden" style={{ background: 'var(--line-2)' }}>
          <div
            style={{
              height: '100%',
              background: 'var(--accent)',
              width: '100%',
              transformOrigin: 'left',
              animation: 'bootBar 3s var(--ease) forwards',
            }}
          />
        </div>
        <style>{`@keyframes bootBar{from{scale:0 1}to{scale:1 1}}`}</style>

        <p className="label fade-in" style={{ animationDelay: '.4s' }}>
          {owner.name} — {owner.location}
        </p>
      </div>

      <p className="label fade-in absolute bottom-8" style={{ animationDelay: '1.6s', opacity: 0.7 }}>
        pulsa para entrar
      </p>
    </div>
  )
}
