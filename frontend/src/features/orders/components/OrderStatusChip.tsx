import { Chip } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { orderStatusLabels, type OrderStatus } from '../types/order'

const orderStatusStyles: Record<OrderStatus, { light: string; dark: string }> = {
  RECEBIDO: { light: '#0369a1', dark: '#38bdf8' },
  EM_PREPARO: { light: '#b45309', dark: '#fbbf24' },
  SAIU_PARA_ENTREGA: { light: '#7c3aed', dark: '#a78bfa' },
  ENTREGUE: { light: '#15803d', dark: '#4ade80' },
  CANCELADO: { light: '#dc2626', dark: '#fb7185' },
}

export function OrderStatusChip({ status }: { status: OrderStatus }) {
  const visual = orderStatusStyles[status]

  return (
    <Chip
      size="small"
      label={orderStatusLabels[status]}
      data-status={status}
      sx={(theme) => {
        const color = theme.palette.mode === 'dark' ? visual.dark : visual.light
        return {
          bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.18 : 0.1),
          border: 1,
          borderColor: alpha(color, 0.6),
          color,
          fontWeight: 700,
          '&::before': {
            bgcolor: color,
            borderRadius: '50%',
            content: '""',
            height: 7,
            marginLeft: 1,
            width: 7,
          },
          '& .MuiChip-label': { px: 1 },
        }
      }}
    />
  )
}
