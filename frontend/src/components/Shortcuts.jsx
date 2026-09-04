import { useEffect } from 'react'

/** Chuleta de atajos. Se abre con «?» y se cierra con Esc o un clic fuera. */
export default function Shortcuts({ open, onClose, apps = [] }) {
  useEffect(() => {
    if (!open) return
    const esc = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [open, onClose])

  if (!open) return null

  const groups = [
    {
      title: 'Escritorio',
      rows: [
        ['⌘K  /', 'buscar fotos, apps, proyectos y acciones'],
        ['F', 'ver todas las ventanas a la vez'],
        ['?', 'esta chuleta'],
        ['⌘W', 'cerrar la ventana de delante'],
        ['Botón dcho.', 'menú del escritorio'],
      ],
    },
    {
      title: 'Apps',
      rows: apps.map((t, i) => [String(i + 1), t.toLowerCase()]),
    },
    {
      title: 'Visor de fotos',
      rows: [
        ['← →', 'foto anterior y siguiente'],
        ['+ − 0', 'acercar, alejar, restablecer'],
        ['I', 'ficha de la foto'],
        ['Espacio', 'pase de diapositivas'],
        ['Esc', 'salir'],
      ],
    },
    {
      title: 'Consola',
      rows: [
        ['Tab', 'completar comando o ruta'],
        ['→', 'aceptar la sugerencia en gris'],
        ['↑ ↓', 'historial'],
        ['^L', 'limpiar'],
      ],
    },
  ]

  return (
    <div
      className="fade-in fixed inset-0 z-[9550] flex items-center justify-center p-4"
      style={{ background: 'color-mix(in srgb, var(--bg-deep) 68%, transparent)', backdropFilter: 'blur(6px)' }}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label="Atajos de teclado"
        className="pop-in scroll-thin max-h-[82vh] w-full max-w-[720px] overflow-auto rounded-2xl p-6 sm:p-7"
        style={{ background: 'var(--panel)', border: '1px solid var(--line-2)', boxShadow: 'var(--shadow-win)' }}
      >
        <header className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="serif text-[26px]">Atajos</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[11.5px] underline decoration-dotted underline-offset-4"
            style={{ color: 'var(--tx-3)' }}
          >
            cerrar
          </button>
        </header>

        <div className="grid gap-x-9 gap-y-6 sm:grid-cols-2">
          {groups.map((g) => (
            <section key={g.title}>
              <h3 className="label mb-2.5">{g.title}</h3>
              <ul className="space-y-1.5">
                {g.rows.map(([k, v]) => (
                  <li key={k + v} className="flex items-start gap-3">
                    <kbd
                      className="mt-px min-w-[74px] shrink-0 rounded-md px-2 py-1 text-center text-[11px]"
                      style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', color: 'var(--tx)' }}
                    >
                      {k}
                    </kbd>
                    <span className="text-[13px]" style={{ color: 'var(--tx-2)' }}>
                      {v}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
