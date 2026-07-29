import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Aislamos el componente del cliente de Supabase: aquí solo nos interesa el
// orden en que consume las fuentes, no cómo se firman las URLs.
vi.mock('@/features/auth/lib/auth-api', () => ({
  resolveAvatarThumbnailUrl: (path: string | null | undefined) =>
    path ? `https://cdn.test/${path.replace(/\.[^/.]+$/, '')}-128.webp` : null,
  resolveAvatarUrl: (path: string | null | undefined) => (path ? `https://cdn.test/${path}` : null)
}))

const { UserAvatar } = await import('@/shared/ui/user-avatar')

const AVATAR_PATH = 'user-id/avatar-uuid.webp'

describe('UserAvatar', () => {
  it('pide primero la miniatura para no bajar el original en los listados', () => {
    render(<UserAvatar name="Ana Pérez" avatarPath={AVATAR_PATH} />)

    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://cdn.test/user-id/avatar-uuid-128.webp'
    )
  })

  it('cae al original cuando la miniatura no existe (fotos previas a la optimización)', () => {
    render(<UserAvatar name="Ana Pérez" avatarPath={AVATAR_PATH} />)

    fireEvent.error(screen.getByRole('img'))

    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.test/user-id/avatar-uuid.webp')
  })

  it('cae a las iniciales solo cuando fallan todas las fuentes', () => {
    render(<UserAvatar name="Ana Pérez" avatarPath={AVATAR_PATH} />)

    fireEvent.error(screen.getByRole('img'))
    fireEvent.error(screen.getByRole('img'))

    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('AP')).toBeInTheDocument()
  })

  it('usa la vista previa local tal cual, sin buscarle miniatura', () => {
    render(<UserAvatar name="Ana Pérez" avatarPath={AVATAR_PATH} avatarUrl="blob:preview" />)

    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:preview')
  })
})
