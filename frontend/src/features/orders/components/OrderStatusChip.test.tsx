import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import { appTheme } from '../../../app/theme/theme'
import { orderStatusLabels, orderStatuses } from '../types/order'
import { OrderStatusChip } from './OrderStatusChip'

describe('indicador de status do pedido', () => {
  it('identifica visualmente todos os status', () => {
    render(
      <ThemeProvider theme={appTheme}>
        {orderStatuses.map((status) => (
          <OrderStatusChip key={status} status={status} />
        ))}
      </ThemeProvider>,
    )

    for (const status of orderStatuses) {
      expect(screen.getByText(orderStatusLabels[status]).closest('[data-status]')).toHaveAttribute(
        'data-status',
        status,
      )
    }
  })
})
