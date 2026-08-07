import { useMemo } from 'react'

import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { surfacePaths } from '@/app/router/surface-paths'
import { useAppSession } from '@/app/providers/app-session-provider'
import {
  LegalClauseSection,
  LegalDocActions,
  LegalDocTabs,
  LegalIdentityPanel,
  LegalMetaPills,
  LegalTableOfContents
} from '@/experiences/institutional/components/legal-center-ui'
import {
  legalDocuments,
  type LegalDocKind
} from '@/experiences/institutional/content/legal-center-content'
import { useScrollSpy } from '@/experiences/institutional/lib/use-scroll-spy'

export function LegalDocumentPage({ kind }: { kind: LegalDocKind }) {
  const document = legalDocuments[kind]
  const clauseIds = useMemo(() => document.clauses.map((clause) => clause.id), [document])
  const activeClauseId = useScrollSpy(clauseIds)
  // Imprimir y consultar el historial son herramientas operativas reservadas
  // al superadministrador estricto de la plataforma (`platform_owner`).
  const { isPlatformOwner } = useAppSession()

  return (
    <div className="pb-6" data-legal-print>
      {/* Masthead */}
      <header className="border-b border-(--asi-outline) bg-gradient-to-b from-(--asi-surface-muted) to-(--asi-surface)">
        <div className="asi-container py-7 sm:py-8">
          <Link
            className="inline-flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-(--asi-primary) transition hover:opacity-80"
            data-legal-chrome
            to={surfacePaths.institutional.legalCenter}
          >
            <ArrowLeft className="size-3.5" />
            Centro legal · ASI
          </Link>
          <h1 className="asi-heading-lg mt-2.5 max-w-[24ch] text-[clamp(1.65rem,3.2vw,2.15rem)]">{document.title}</h1>
          <p className="asi-copy mt-3 max-w-[68ch] text-[0.95rem] leading-6">{document.lede}</p>
          <div className="mt-4">
            <LegalMetaPills document={document} />
          </div>
          {isPlatformOwner ? (
            <div className="mt-4" data-legal-chrome>
              <LegalDocActions document={document} />
            </div>
          ) : null}
        </div>
      </header>

      <LegalDocTabs activeKind={document.kind} />

      {/* Body: TOC + content */}
      <div
        className="asi-container grid gap-8 py-8 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-12 lg:py-10"
        data-testid="legal-document-body"
      >
        <LegalTableOfContents activeId={activeClauseId} clauses={document.clauses} />

        <div className="max-w-[43rem]">
          <p className="rounded-card border border-(--asi-outline) bg-(--asi-surface-muted) p-4 text-[0.92rem] leading-6 text-(--asi-text-muted) [&_strong]:font-semibold [&_strong]:text-(--asi-text)">
            {document.intro}
          </p>

          <div className="mt-7 space-y-7">
            {document.clauses.map((clause, index) => (
              <LegalClauseSection key={clause.id} clause={clause} index={index} />
            ))}
          </div>

          <div className="mt-8" data-legal-chrome>
            <LegalIdentityPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
