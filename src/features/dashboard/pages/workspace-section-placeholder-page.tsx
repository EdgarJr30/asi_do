import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'

export function WorkspaceSectionPlaceholderPage({
  eyebrow,
  title,
  description
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <EmptyState
        title="Sección en construcción"
        description="Estamos preparando esta vista del workspace. Muy pronto estará disponible aquí."
      />
    </div>
  )
}
