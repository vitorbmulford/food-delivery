import { useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material'
import { ArrowRight, X } from 'lucide-react'
import { allowedNextStatuses, type Order, type OrderStatus } from '../types/order'
import { useUpdateOrderStatus } from '../hooks/useOrders'
import { getOrderErrorMessage } from '../utils/orderFormat'

export function OrderStatusActions({
  order,
  compact = false,
}: {
  order: Order
  compact?: boolean
}) {
  const [confirmCancel, setConfirmCancel] = useState(false)
  const update = useUpdateOrderStatus()
  const nextStatuses = allowedNextStatuses[order.status]
  const transitionStatuses = nextStatuses.filter((status) => status !== 'CANCELADO')
  const isConflict =
    update.error &&
    typeof update.error === 'object' &&
    'response' in update.error &&
    typeof update.error.response === 'object' &&
    update.error.response !== null &&
    'status' in update.error.response &&
    update.error.response.status === 409

  const changeStatus = (status: OrderStatus) => update.mutate({ id: order.id, status })

  return (
    <Stack
      role="group"
      aria-label="Ações disponíveis para este pedido"
      direction="row"
      spacing={1.25}
      sx={{ flexWrap: 'wrap', alignItems: 'center' }}
    >
      {transitionStatuses.map((status) => (
        <Button
          key={status}
          size="small"
          variant="outlined"
          endIcon={<ArrowRight size={16} aria-hidden="true" />}
          sx={compact ? { minWidth: 0, px: 1.5, py: 0.75 } : undefined}
          disabled={update.isPending}
          onClick={() => changeStatus(status)}
        >
          {status === 'EM_PREPARO'
            ? 'Iniciar preparo'
            : status === 'SAIU_PARA_ENTREGA'
              ? 'Saiu para entrega'
              : 'Marcar entregue'}
        </Button>
      ))}
      {nextStatuses.includes('CANCELADO') && (
        <Button
          size="small"
          color="error"
          variant={compact ? 'outlined' : 'text'}
          startIcon={<X size={15} aria-hidden="true" />}
          sx={compact ? { minWidth: 0, px: 1.5, py: 0.75 } : undefined}
          disabled={update.isPending}
          onClick={() => setConfirmCancel(true)}
        >
          Cancelar
        </Button>
      )}
      {update.isPending && <span aria-live="polite">Atualizando…</span>}
      {update.isError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {isConflict
            ? 'O pedido foi alterado em outra operação. Os dados atuais foram recarregados.'
            : getOrderErrorMessage(update.error, 'Não foi possível atualizar o pedido.')}
        </Alert>
      )}
      {update.isSuccess && <span role="status">Status atualizado.</span>}
      <Dialog open={confirmCancel} onClose={() => !update.isPending && setConfirmCancel(false)}>
        <DialogTitle>Cancelar pedido?</DialogTitle>
        <DialogContent>
          O pedido será marcado como cancelado. Essa alteração não pode ser desfeita.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmCancel(false)} disabled={update.isPending}>
            Voltar
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={update.isPending}
            onClick={() => {
              changeStatus('CANCELADO')
              setConfirmCancel(false)
            }}
          >
            Confirmar cancelamento
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
