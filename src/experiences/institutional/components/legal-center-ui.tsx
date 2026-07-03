import { useRef, useState, type ReactNode } from 'react'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { History, Printer } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import { legalIdentity } from '@/experiences/institutional/content/payment-compliance-content'
import {
  legalDocumentList,
  metaPillIcons,
  type LegalChangelogEntry,
  type LegalClause,
  type LegalDocument
} from '@/experiences/institutional/content/legal-center-content'
import { cn } from '@/lib/utils/cn'

/* ------------------------------------------------------------------ */
/* Document switcher — real links to each policy URL (aria-current).    */
/* Keyboard: ←/→/↑/↓ + Home/End move focus across the document tabs.    */
/* ------------------------------------------------------------------ */
export function LegalDocTabs({ activeKind }: { activeKind: LegalDocument['kind'] }) {
  const { pathname } = useLocation()
  const tabRefs = useRef<Array<HTMLAnchorElement | null>>([])

  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    const lastIndex = legalDocumentList.length - 1
    let nextIndex: number | null = null

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = index === lastIndex ? 0 : index + 1
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = index === 0 ? lastIndex : index - 1
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = lastIndex

    if (nextIndex !== null) {
      event.preventDefault()
      tabRefs.current[nextIndex]?.focus()
    }
  }

  return (
    <div
      className="sticky top-[4.75rem] z-30 border-b border-(--asi-outline) bg-(--asi-surface)/85 backdrop-blur-md lg:top-20"
      data-legal-chrome
    >
      <div className="asi-container">
        <nav
          aria-label="Documentos legales"
          className="tm-scrollbar flex gap-1 overflow-x-auto"
        >
          {legalDocumentList.map((document, index) => {
            const Icon = document.icon
            const isActive = document.kind === activeKind || pathname === document.path

            return (
              <Link
                key={document.kind}
                ref={(node) => {
                  tabRefs.current[index] = node
                }}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-1 py-4 text-sm font-semibold transition-colors',
                  'mr-5 last:mr-0',
                  isActive ? 'text-(--asi-primary)' : 'text-(--asi-secondary) hover:text-(--asi-text)'
                )}
                to={document.path}
                onKeyDown={(event) => handleKeyDown(event, index)}
              >
                <Icon
                  className={cn(
                    'size-4 transition-colors',
                    isActive ? 'text-(--asi-primary)' : 'text-(--asi-secondary)/70 group-hover:text-(--asi-secondary)'
                  )}
                />
                {document.tabLabel}
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-0 -bottom-px h-0.5 origin-left rounded-full bg-(--asi-primary) transition-transform duration-200',
                    isActive ? 'scale-x-100' : 'scale-x-0'
                  )}
                />
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Metadata pills — effective date, version, reading time.             */
/* ------------------------------------------------------------------ */
export function LegalMetaPills({ document }: { document: LegalDocument }) {
  const pills = [
    { icon: metaPillIcons.date, label: 'Vigente desde', value: document.effectiveDate },
    { icon: metaPillIcons.version, label: 'Versión', value: document.version },
    { icon: metaPillIcons.reading, label: 'Lectura', value: document.readingTime }
  ]

  return (
    <div className="flex flex-wrap gap-2.5">
      {pills.map((pill) => {
        const Icon = pill.icon
        return (
          <span
            key={pill.label}
            className="inline-flex items-center gap-2 rounded-pill border border-(--asi-outline) bg-white px-3.5 py-1.5 text-[0.82rem] font-semibold text-(--asi-secondary)"
          >
            <Icon className="size-3.5 text-(--asi-primary)" />
            {pill.label} <b className="font-bold text-(--asi-text)">{pill.value}</b>
          </span>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Actions — print/download + version history toggle.                  */
/* ------------------------------------------------------------------ */
export function LegalDocActions({ document }: { document: LegalDocument }) {
  const [changelogOpen, setChangelogOpen] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  return (
    <div data-legal-chrome>
      <div className="flex flex-wrap gap-2.5">
        <button
          className="asi-button asi-button-primary min-h-0 px-4 py-2.5 text-[0.85rem]"
          type="button"
          onClick={() => window.print()}
        >
          <Printer className="size-4" />
          Descargar / Imprimir
        </button>
        <button
          aria-controls={`changelog-${document.kind}`}
          aria-expanded={changelogOpen}
          className="asi-button asi-button-secondary min-h-0 px-4 py-2.5 text-[0.85rem]"
          type="button"
          onClick={() => setChangelogOpen((open) => !open)}
        >
          <History className="size-4" />
          Ver cambios (v{document.version})
        </button>
      </div>

      <AnimatePresence initial={false}>
        {changelogOpen ? (
          <motion.div
            key="changelog"
            className="overflow-hidden"
            initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
            animate={shouldReduceMotion ? undefined : { height: 'auto', opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <LegalChangelog id={`changelog-${document.kind}`} entries={document.changelog} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export function LegalChangelog({ id, entries }: { id?: string; entries: LegalChangelogEntry[] }) {
  return (
    <div
      className="mt-4 max-w-2xl overflow-hidden rounded-card border border-(--asi-outline) bg-white"
      id={id}
    >
      {entries.map((entry) => (
        <div
          key={entry.version}
          className="grid grid-cols-[6.5rem_1fr] gap-4 border-t border-(--asi-outline) px-4 py-3.5 first:border-t-0"
        >
          <div className="text-[0.85rem] font-bold text-(--asi-primary)">
            v{entry.version}
            <span className="mt-0.5 block text-[0.72rem] font-medium text-(--asi-secondary)">{entry.date}</span>
          </div>
          <p className="text-[0.85rem] leading-6 text-(--asi-text-muted)">{entry.note}</p>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Table of contents with scroll-spy highlight.                        */
/* ------------------------------------------------------------------ */
export function LegalTableOfContents({
  clauses,
  activeId
}: {
  clauses: LegalClause[]
  activeId: string | null
}) {
  return (
    <aside className="sticky top-32 hidden lg:block" data-legal-chrome>
      <p className="mb-3.5 pl-3.5 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-(--asi-secondary)">
        Contenido
      </p>
      <nav aria-label="Índice del documento" className="flex flex-col">
        {clauses.map((clause, index) => {
          const isActive = clause.id === activeId
          return (
            <a
              key={clause.id}
              className={cn(
                'flex items-baseline gap-2.5 border-l-2 py-1.5 pl-3.5 text-[0.84rem] leading-snug transition-colors',
                isActive
                  ? 'border-(--asi-primary) font-semibold text-(--asi-primary)'
                  : 'border-(--asi-outline) text-(--asi-secondary) hover:border-(--asi-primary)/50 hover:text-(--asi-text)'
              )}
              href={`#${clause.id}`}
            >
              <span
                className={cn(
                  'text-[0.7rem] font-bold tabular-nums',
                  isActive ? 'text-(--asi-primary)' : 'text-(--asi-secondary)/70'
                )}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              {clause.tocLabel}
            </a>
          )
        })}
      </nav>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Clause renderer — paragraphs, lists, callouts, definitions, steps.  */
/* ------------------------------------------------------------------ */
export function LegalClauseSection({ clause, index }: { clause: LegalClause; index: number }) {
  return (
    <section
      className="scroll-mt-36 border-t border-(--asi-outline) pt-10 first:border-t-0 first:pt-0"
      id={clause.id}
    >
      <h2 className="flex items-baseline gap-3 text-[1.35rem] font-bold tracking-tight text-(--asi-text)">
        <span className="text-sm font-bold tabular-nums text-(--asi-primary)">
          {String(index + 1).padStart(2, '0')}
        </span>
        {clause.title}
      </h2>
      <div className="mt-4 space-y-4">
        {clause.blocks.map((block, blockIndex) => (
          <LegalBlock key={blockIndex} block={block} />
        ))}
      </div>
    </section>
  )
}

function LegalBlock({ block }: { block: LegalClause['blocks'][number] }) {
  switch (block.kind) {
    case 'paragraph':
      return <p className="asi-copy text-[0.98rem] [&_strong]:font-semibold [&_strong]:text-(--asi-text)">{block.content}</p>
    case 'subheading':
      return <h3 className="pt-2 text-[0.98rem] font-bold text-(--asi-text)">{block.text}</h3>
    case 'list':
      return (
        <ul className="space-y-2.5">
          {block.items.map((item, index) => (
            <li
              key={index}
              className="relative pl-6 text-[0.98rem] leading-7 text-(--asi-text-muted) [&_strong]:font-semibold [&_strong]:text-(--asi-text)"
            >
              <span className="absolute left-1 top-3 size-1.5 rounded-full bg-(--asi-primary)" />
              {item}
            </li>
          ))}
        </ul>
      )
    case 'definitions':
      return (
        <dl className="overflow-hidden rounded-card border border-(--asi-outline) bg-white">
          {block.items.map((item) => (
            <div
              key={item.term}
              className="grid gap-1 border-t border-(--asi-outline) px-4 py-3.5 first:border-t-0 sm:grid-cols-[11rem_1fr] sm:gap-4"
            >
              <dt className="text-[0.9rem] font-bold text-(--asi-text)">{item.term}</dt>
              <dd className="text-[0.9rem] leading-6 text-(--asi-text-muted)">{item.description}</dd>
            </div>
          ))}
        </dl>
      )
    case 'steps':
      return (
        <div className="mt-1">
          {block.items.map((item, index) => (
            <div key={item.title} className="relative grid grid-cols-[2.25rem_1fr] gap-4 pb-5 last:pb-0">
              {index < block.items.length - 1 ? (
                <span className="absolute left-[1.06rem] top-9 bottom-0 w-0.5 bg-(--asi-outline)" />
              ) : null}
              <span className="z-10 grid size-9 place-items-center rounded-full border border-(--asi-outline) bg-(--asi-surface-muted) text-sm font-bold text-(--asi-primary)">
                {index + 1}
              </span>
              <div>
                <h3 className="text-[0.98rem] font-bold text-(--asi-text)">{item.title}</h3>
                <p className="mt-1 text-[0.95rem] leading-7 text-(--asi-text-muted)">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      )
    case 'callout':
      return <LegalCallout tone={block.tone} icon={block.icon} content={block.content} />
  }
}

function LegalCallout({
  tone,
  icon: Icon,
  content
}: {
  tone: 'green' | 'blue'
  icon: React.ComponentType<{ className?: string }>
  content: ReactNode
}) {
  const isGreen = tone === 'green'
  return (
    <div
      className={cn(
        'flex gap-3.5 rounded-card border p-4',
        isGreen ? 'border-[#cdeadb] bg-[#eef8f2]' : 'border-[#d6e0f2] bg-(--asi-surface-muted)'
      )}
    >
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-control',
          isGreen ? 'bg-[#1f9d61]/14 text-[#1f9d61]' : 'bg-(--asi-primary)/10 text-(--asi-primary)'
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <p
        className={cn(
          'text-[0.92rem] leading-6 [&_a]:font-semibold [&_strong]:font-bold',
          isGreen ? 'text-[#1c6844] [&_strong]:text-[#14512f]' : 'text-[#33477a] [&_strong]:text-(--asi-primary)'
        )}
      >
        {content}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Legal identity — company registration data (exigibilidad legal).    */
/* ------------------------------------------------------------------ */
export function LegalIdentityPanel({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-card-lg border border-(--asi-outline) bg-white/80 p-5 sm:p-6', className)}
      data-legal-chrome
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--asi-secondary)">Datos legales de la entidad</p>
      <dl className="mt-4 grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
        {legalIdentity.map((item) => (
          <div key={item.label}>
            <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-(--asi-secondary)">{item.label}</dt>
            <dd className="mt-0.5 text-[0.9rem] font-medium leading-6 text-(--asi-text)">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
