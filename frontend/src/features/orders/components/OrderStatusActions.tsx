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
import { allowedNextStatuses, type Order, type OrderStatus } from '../types/order'
import { useUpdateOrderStatus } from '../hooks/useOrders'
import { getOrderErrorMessage } from '../utils/orderFormat'

export function OrderStatusActions({ order }: { order: Order }) {
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
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
      {transitionStatuses.map((status) => (
        <Button
          key={status}
          size="small"
          variant="outlined"
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
            ? 'O status mudou em outra operação. A lista foi atualizada.'
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
