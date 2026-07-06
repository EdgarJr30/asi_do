import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { useUrlParamState } from '@/hooks/use-url-param-state'

function wrapperFor(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
  }
}

describe('useUrlParamState', () => {
  it('lee el valor inicial desde la query string', () => {
    const { result } = renderHook(() => useUrlParamState('status'), {
      wrapper: wrapperFor('/x?status=hired')
    })

    expect(result.current[0]).toBe('hired')
  })

  it('cae al defaultValue cuando el parámetro no está presente', () => {
    const { result } = renderHook(() => useUrlParamState('sort', 'recent'), {
      wrapper: wrapperFor('/x')
    })

    expect(result.current[0]).toBe('recent')
  })

  it('escribe el valor en la URL al actualizar', () => {
    const { result } = renderHook(
      () => ({ state: useUrlParamState('status'), location: useLocation() }),
      { wrapper: wrapperFor('/x') }
    )

    act(() => result.current.state[1]('hired'))

    expect(result.current.state[0]).toBe('hired')
    expect(result.current.location.search).toBe('?status=hired')
  })

  it('OMITE el parámetro cuando el valor es vacío o el default (URL limpia)', () => {
    const { result } = renderHook(
      () => ({ state: useUrlParamState<'recent' | 'oldest'>('sort', 'recent'), location: useLocation() }),
      { wrapper: wrapperFor('/x?sort=oldest&q=ana') }
    )

    expect(result.current.state[0]).toBe('oldest')

    act(() => result.current.state[1]('recent'))

    // 'recent' es el default → se elimina de la URL, preservando el resto (q=ana).
    expect(result.current.location.search).toBe('?q=ana')
    expect(result.current.state[0]).toBe('recent')
  })

  it('preserva otros parámetros al actualizar uno', () => {
    const { result } = renderHook(
      () => ({ state: useUrlParamState('status'), location: useLocation() }),
      { wrapper: wrapperFor('/x?q=ana&sort=oldest') }
    )

    act(() => result.current.state[1]('rejected'))

    const params = new URLSearchParams(result.current.location.search)
    expect(params.get('status')).toBe('rejected')
    expect(params.get('q')).toBe('ana')
    expect(params.get('sort')).toBe('oldest')
  })
})
