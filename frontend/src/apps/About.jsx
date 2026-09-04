import Handwriting from '../components/Handwriting'
import { useContent } from '../lib/content'

export default function About() {
  const { owner } = useContent()
  return (
    <div className="px-6 pt-6 pb-8 sm:px-8">
      <Handwriting text={owner.greeting} height={78} color="var(--accent)" duration={1} />

      <h3 className="serif animate-in mt-5 text-[clamp(1.9rem,4.4vw,2.9rem)]" style={{ animationDelay: '.9s' }}>
        Soy {owner.name}.
      </h3>

      <p className="label animate-in mt-2" style={{ animationDelay: '.96s' }}>
        {owner.role}
      </p>

      <div className="mt-6 max-w-[62ch] space-y-4">
        {owner.bio.map((p, i) => (
          <p
            key={i}
            className="animate-in text-[15px] leading-[1.72]"
            style={{ color: 'var(--tx-2)', animationDelay: `${1.02 + i * 0.06}s` }}
          >
            {p}
          </p>
        ))}
      </div>

      <div
        className="animate-in mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t pt-6"
        style={{ borderColor: 'var(--line)', animationDelay: '1.2s' }}
      >
        {owner.links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target={l.href.startsWith('http') ? '_blank' : undefined}
            rel="noreferrer"
            className="group inline-flex items-center gap-1.5 text-[13.5px] transition-colors duration-200"
            style={{ color: 'var(--tx-2)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--tx-2)')}
          >
            {l.label}
            <span className="transition-transform duration-200 group-hover:translate-x-0.5">↗</span>
          </a>
        ))}
      </div>
    </div>
  )
}
