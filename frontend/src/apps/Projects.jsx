import { useContent } from '../lib/content'

/** Lista de proyectos. Fila alta, número al margen, revelado al pasar. */
export default function Projects() {
  const { projects } = useContent()
  return (
    <div className="px-5 pt-5 pb-8 sm:px-7">
      <header className="mb-5 flex items-baseline justify-between gap-4">
        <h3 className="serif text-[26px]">Otras cosas</h3>
        <span className="label">{projects.length}</span>
      </header>

      <ul>
        {projects.map((p, i) => {
          const Tag = p.href ? 'a' : 'div'
          return (
            <li key={p.id} className="animate-in" style={{ animationDelay: `${i * 60}ms` }}>
              <Tag
                {...(p.href ? { href: p.href, target: '_blank', rel: 'noreferrer' } : {})}
                className="group grid grid-cols-[2rem_1fr_auto] items-start gap-x-4 border-t py-5 transition-colors duration-300"
                style={{ borderColor: 'var(--line)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-soft)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="tnum label pt-1.5">{String(i + 1).padStart(2, '0')}</span>

                <div className="min-w-0">
                  <h4 className="serif flex items-center gap-2 text-[22px]">
                    {p.title}
                    {p.href && (
                      <span
                        className="text-[13px] opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-70"
                        style={{ color: 'var(--accent)' }}
                      >
                        ↗
                      </span>
                    )}
                  </h4>
                  <p className="mt-1.5 max-w-[54ch] text-[14px] leading-relaxed" style={{ color: 'var(--tx-2)' }}>
                    {p.blurb}
                  </p>
                </div>

                <div className="pt-1.5 text-right">
                  <span
                    className="inline-block rounded-full px-2.5 py-1 text-[10.5px] tracking-wide uppercase"
                    style={{ border: '1px solid var(--line-2)', color: 'var(--tx-3)' }}
                  >
                    {p.kind}
                  </span>
                  <p className="tnum mt-1.5 text-[11.5px]" style={{ color: 'var(--tx-3)' }}>
                    {p.year}
                  </p>
                </div>
              </Tag>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
