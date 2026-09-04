import { useEffect, useRef, useState } from 'react'
import WorldClock from './WorldClock'
import { useContent } from '../lib/content'
import { IconSun, IconMoon, IconSearch } from '../icons/Icons'

/** Barra superior: identidad, menús, buscador, reloj mundial y tema. */
/** Barritas que suben y bajan mientras hay música. */
function Bars() {
  return (
    <span className="flex h-3 shrink-0 items-end gap-[1.5px]" aria-hidden="true">
      <style>{`@keyframes mbEq{0%,100%{height:25%}50%{height:100%}}`}</style>
      {[0, 1, 2].map((n) => (
        <span
          key={n}
          className="w-[2px] rounded-full"
          style={{
            background: 'var(--accent)',
            // alto de partida: la animación gana en la cascada, así que mientras
            // suena se ve igual, y con movimiento reducido queda un icono quieto
            // y asimétrico en lugar de tres barras invisibles
            height: ['45%', '100%', '65%'][n],
            animation: `mbEq ${0.62 + n * 0.19}s ease-in-out infinite`,
          }}
        />
      ))}
    </span>
  )
}

export default function MenuBar({ menus, theme, onToggleTheme, onSearch, nowPlaying, onNowPlaying }) {
  const { owner } = useContent()
  const [openMenu, setOpenMenu] = useState(null)
  const barRef = useRef(null)

  useEffect(() => {
    if (!openMenu) return
    const away = (e) => !barRef.current?.contains(e.target) && setOpenMenu(null)
    const esc = (e) => e.key === 'Escape' && setOpenMenu(null)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [openMenu])

  return (
    <header
      ref={barRef}
      className="chrome-blur fixed inset-x-0 top-0 z-[9000] flex h-[34px] items-center gap-1 border-b"
      style={{
        borderColor: 'var(--line)',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
      }}
    >
      {/* el único h1 de la página; el preflight de Tailwind ya iguala tamaño y peso */}
      <h1 className="serif mr-2 shrink-0 pr-1 text-[17px] leading-none sm:text-[18px]" style={{ color: 'var(--tx)' }}>
        {owner.siteName ?? owner.name.split(' ')[0]}
        <span style={{ color: 'var(--accent)' }}>.</span>
      </h1>

      <nav className="flex min-w-0 items-center gap-0.5">
        {menus.map((m) => (
          <div key={m.label} className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu((v) => (v === m.label ? null : m.label))}
              onMouseEnter={() => openMenu && setOpenMenu(m.label)}
              aria-expanded={openMenu === m.label}
              className="rounded-md px-2 py-1 text-[12.5px] whitespace-nowrap transition-colors duration-150 hover:bg-[var(--line)]"
              style={{
                color: openMenu === m.label ? 'var(--accent)' : 'var(--tx-2)',
                // undefined y no 'transparent': si no, el estilo en línea pisa
                // el hover de la clase y el botón deja de responder al ratón
                background: openMenu === m.label ? 'var(--accent-soft)' : undefined,
              }}
            >
              {m.label}
            </button>

            {openMenu === m.label && (
              <div
                role="menu"
                className="pop-in absolute top-full left-0 mt-1 w-56 rounded-xl p-1.5 max-sm:fixed max-sm:inset-x-2 max-sm:top-[38px] max-sm:mt-0 max-sm:w-auto"
                style={{ background: 'var(--panel)', border: '1px solid var(--line-2)', boxShadow: 'var(--shadow-pop)' }}
              >
                {m.items.map((it, n) =>
                  it.sep ? (
                    <div key={n} className="my-1.5 h-px" style={{ background: 'var(--line)' }} />
                  ) : (
                    <button
                      key={n}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        it.action?.()
                        setOpenMenu(null)
                      }}
                      className="flex w-full items-center justify-between gap-4 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors duration-150 max-sm:py-3"
                      style={{ color: 'var(--tx)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-soft)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {it.label}
                      {it.hint && (
                        <kbd className="text-[10.5px]" style={{ color: 'var(--tx-3)' }}>
                          {it.hint}
                        </kbd>
                      )}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        {/* lo que está sonando, si está sonando */}
        {nowPlaying && (
          <button
            type="button"
            onClick={onNowPlaying}
            title={`${nowPlaying.title} — ${nowPlaying.artist}`}
            className="fade-in mr-1 hidden max-w-[190px] items-center gap-2 rounded-lg px-2 py-1 text-[11.5px] transition-colors duration-200 md:flex"
            style={{ color: 'var(--tx-2)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--line)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Bars />
            <span className="truncate">{nowPlaying.title}</span>
          </button>
        )}

        {/* buscador */}
        <button
          type="button"
          onClick={onSearch}
          title="Buscar  ⌘K"
          aria-label="Buscar"
          className="hidden items-center gap-2 rounded-lg py-1 pr-1.5 pl-2 text-[12px] transition-colors duration-200 sm:flex"
          style={{ border: '1px solid var(--line)', color: 'var(--tx-3)' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
        >
          <IconSearch size={12} />
          <span className="hidden md:inline">Buscar</span>
          <kbd
            className="rounded px-1 py-px text-[10px]"
            style={{ border: '1px solid var(--line)', color: 'var(--tx-3)' }}
          >
            ⌘K
          </kbd>
        </button>

        <span className="mx-1 hidden text-[11.5px] lg:inline" style={{ color: 'var(--tx-3)' }}>
          {owner.location}
        </span>

        <WorldClock />

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
          className="grid h-7 w-7 place-items-center rounded-md transition-colors duration-200"
          style={{ color: 'var(--tx-2)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--line)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {theme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}
        </button>
      </div>
    </header>
  )
}
