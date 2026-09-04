import { useEffect, useRef } from 'react'

/**
 * Fondo de escritorio: dos manchas de color que derivan muy despacio, una
 * luz que sigue al puntero, retícula fina, grano y viñeta.
 * Todo con CSS y un SVG: ni una imagen, ni una petición.
 */
export default function Wallpaper() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    let tx = 0.5
    let ty = 0.35

    const onMove = (e) => {
      tx = e.clientX / window.innerWidth
      ty = e.clientY / window.innerHeight
      if (!raf) raf = requestAnimationFrame(apply)
    }
    const apply = () => {
      raf = 0
      el.style.setProperty('--mx', `${(tx * 100).toFixed(2)}%`)
      el.style.setProperty('--my', `${(ty * 100).toFixed(2)}%`)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    apply()
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ '--mx': '50%', '--my': '35%' }}
    >
      {/* manchas de color a la deriva */}
      <div
        className="absolute -inset-[20%]"
        style={{
          background:
            'radial-gradient(46% 42% at 74% 14%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 68%)',
          animation: 'driftA 34s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -inset-[20%]"
        style={{
          background:
            'radial-gradient(44% 40% at 16% 88%, color-mix(in srgb, var(--accent-2) 24%, transparent), transparent 66%)',
          animation: 'driftB 46s ease-in-out infinite',
        }}
      />

      {/* luz que sigue al cursor */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background:
            'radial-gradient(340px 340px at var(--mx) var(--my), color-mix(in srgb, var(--tx) 6%, transparent), transparent 70%)',
        }}
      />

      {/* retícula + grano */}
      <svg className="absolute inset-0 h-full w-full">
        <defs>
          <pattern id="wp-grid" width="46" height="46" patternUnits="userSpaceOnUse">
            <path d="M46 0H0v46" fill="none" stroke="var(--line)" strokeWidth="1" />
          </pattern>
          <filter id="wp-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#wp-grid)" opacity="0.5" />
        <rect width="100%" height="100%" filter="url(#wp-grain)" opacity="0.04" />
      </svg>

      {/* viñeta */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 100% at 50% 40%, transparent 52%, rgba(0,0,0,.28))' }}
      />
    </div>
  )
}
