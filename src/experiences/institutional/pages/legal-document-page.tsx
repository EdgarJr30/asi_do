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
  // La metadata operativa (vigencia, versión, imprimir, historial de cambios) es
  // ruido para el público general; solo la exponemos a quienes administran la consola.
  const { canAccessAdminConsole } = useAppSession()

  return (
    <div className="pb-6" data-legal-print>
      {/* Masthead */}
      <header className="border-b border-(--asi-outline) bg-gradient-to-b from-(--asi-surface-muted) to-(--asi-surface)">
        <div className="asi-container py-10 sm:py-12">
          <Link
            className="inline-flex items-center gap-1.5 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-(--asi-primary) transition hover:opacity-80"
            data-legal-chrome
            to={surfacePaths.institutional.legalCenter}
          >
            <ArrowLeft className="size-3.5" />
            Centro legal · ASI
          </Link>
          <h1 className="asi-heading-lg mt-3.5 max-w-[20ch] text-[clamp(1.9rem,4vw,2.6rem)]">{document.title}</h1>
          <p className="asi-copy mt-4 max-w-[62ch] text-[1.05rem]">{document.lede}</p>
          <div className="mt-6">
            <LegalMetaPills document={document} includeOperational={canAccessAdminConsole} />
          </div>
          {canAccessAdminConsole ? (
            <div className="mt-5" data-legal-chrome>
              <LegalDocActions document={document} />
            </div>
          ) : null}
        </div>
      </header>

      <LegalDocTabs activeKind={document.kind} />

      {/* Body: TOC + content */}
      <div className="asi-container grid gap-10 py-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16 lg:py-14">
        <LegalTableOfContents activeId={activeClauseId} clauses={document.clauses} />

        <div className="max-w-[46rem]">
          <p className="rounded-card border border-(--asi-outline) bg-(--asi-surface-muted) px-5 py-4 text-[1rem] leading-7 text-(--asi-text-muted) [&_strong]:font-semibold [&_strong]:text-(--asi-text)">
            {document.intro}
          </p>

          <div className="mt-10 space-y-10">
            {document.clauses.map((clause, index) => (
              <LegalClauseSection key={clause.id} clause={clause} index={index} />
            ))}
          </div>

          <div className="mt-12" data-legal-chrome>
            <LegalIdentityPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
