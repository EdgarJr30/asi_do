export type PaginationItem = number | 'ellipsis'

export function getPaginationItems(page: number, totalPages: number, siblingCount = 1): PaginationItem[] {
  if (totalPages <= 0) return []

  const safePage = Math.min(Math.max(page, 0), totalPages - 1)
  const visiblePages = new Set<number>([0, totalPages - 1])
  const start = Math.max(0, safePage - siblingCount)
  const end = Math.min(totalPages - 1, safePage + siblingCount)

  for (let index = start; index <= end; index += 1) {
    visiblePages.add(index)
  }

  const items: PaginationItem[] = []
  let previousPage: number | null = null

  for (const pageIndex of [...visiblePages].sort((left, right) => left - right)) {
    if (previousPage !== null && pageIndex - previousPage > 1) {
      items.push('ellipsis')
    }

    items.push(pageIndex)
    previousPage = pageIndex
  }

  return items
}
