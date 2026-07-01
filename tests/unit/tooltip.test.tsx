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
})
