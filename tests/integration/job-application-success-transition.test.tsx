import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMyCandidateProfile = vi.hoisted(() => vi.fn())
const getPublicJobBySlug = vi.hoisted(() => vi.fn())
const listMyApplications = vi.hoisted(() => vi.fn())
const submitApplication = vi.hoisted(() => vi.fn())
const updateApplicationResume = vi.hoisted(() => vi.fn())

vi.mock('@/features/candidate-profile/lib/candidate-profile-api', () => ({ fetchMyCandidateProfile }))
vi.mock('@/features/jobs/lib/jobs-api', () => ({ getPublicJobBySlug }))
vi.mock('@/features/applications/lib/applications-api', () => ({
  listMyApplications,
  submitApplication,
  updateApplicationResume
}))
vi.mock('@/app/providers/app-session-provider', () => ({
  useAppSession: () => ({ authUser: { id: 'candidate-1', email: 'candidate@example.com' } })
}))
vi.mock('@/features/tenants/components/company-logo', () => ({
  CompanyLogo: () => <div aria-hidden="true" />
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })

  return { promise, resolve }
}

describe('transición al completar una postulación', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('muestra el éxito antes de refrescar las consultas que revelan la postulación creada', async () => {
    let applicationCreated = false
    const jobRefresh = deferred<typeof job>()
    const job = {
      id: 'job-1',
      title: 'Diseñador de producto',
      workplace_type: 'remote',
      company_profile: { display_name: 'ASI', logo_path: null },
      job_screening_questions: []
    }
    const createdApplication = {
      id: 'application-1',
      job_posting_id: job.id,
      submitted_resume_id: 'resume-1',
      submitted_resume_filename: 'cv.pdf'
    }

    fetchMyCandidateProfile.mockResolvedValue({
      profile: { id: 'profile-1' },
      resumes: [
        {
          id: 'resume-1',
          filename: 'cv.pdf',
          uploaded_at: '2026-08-11T12:00:00.000Z',
          file_size_bytes: 120_000,
          is_default: true
        }
      ]
    })
    getPublicJobBySlug.mockImplementation(() =>
      applicationCreated ? jobRefresh.promise : Promise.resolve(job)
    )
    listMyApplications.mockImplementation(() =>
      Promise.resolve(applicationCreated ? [createdApplication] : [])
    )
    submitApplication.mockImplementation(() => {
      applicationCreated = true
      return Promise.resolve(createdApplication)
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
    const { JobApplicationPage } = await import(
      '@/features/applications/pages/job-application-page'
    )
    const view = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/jobs/disenador/apply']}>
          <Routes>
            <Route path="/jobs/:jobSlug/apply" element={<JobApplicationPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    await screen.findByRole('heading', { name: 'Tu CV' })
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    fireEvent.click(screen.getByRole('button', { name: /^revisar$/i }))
    fireEvent.click(screen.getByRole('button', { name: /enviar postulación/i }))

    await waitFor(() => expect(getPublicJobBySlug).toHaveBeenCalledTimes(2))

    expect(screen.getByRole('heading', { name: 'Postulación enviada' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Actualizar CV enviado' })).toBeNull()

    jobRefresh.resolve(job)
    await waitFor(() => expect(submitApplication).toHaveBeenCalledTimes(1))
    view.unmount()
    queryClient.clear()
  })
})
