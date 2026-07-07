import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Tooltip } from '@/components/ui/tooltip'

describe('Tooltip', () => {
  it('hides after activating the trigger while focus remains on it', () => {
    render(
      <Tooltip label="Modo claro" side="bottom">
        <button type="button">Cambiar tema</button>
      </Tooltip>
    )

    const trigger = screen.getByRole('button', { name: 'Cambiar tema' })
    const tooltip = screen.getByRole('tooltip')

    fireEvent.mouseEnter(trigger.parentElement as HTMLElement)

    expect(tooltip).toHaveClass('opacity-100')

    fireEvent.pointerDown(trigger)
    trigger.focus()
    fireEvent.click(trigger)

    expect(trigger).toHaveFocus()
    expect(tooltip).not.toHaveClass('opacity-100')
  })

  it('can toggle open from a pointer tap without relying on focus', () => {
    render(
      <Tooltip activation="toggle" label="El nombre público visible para candidatos." side="top">
        <button type="button">Mas informacion</button>
      </Tooltip>
    )

    const trigger = screen.getByRole('button', { name: 'Mas informacion' })
    const tooltip = screen.getByRole('tooltip')

    fireEvent.pointerDown(trigger)
    trigger.focus()
    fireEvent.click(trigger)

    expect(tooltip).toHaveClass('opacity-100')

    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)

    expect(tooltip).not.toHaveClass('opacity-100')
  })
})
