import { Alert, Box, Button, Divider, Skeleton, Stack, Typography } from '@mui/material'
import { useOrderHistory } from '../hooks/useOrders'
import { orderStatusLabels } from '../types/order'
import { sortOrderHistory } from '../utils/orderHistory'
import { formatOrderDate, getOrderErrorMessage } from '../utils/orderFormat'

export function OrderStatusTimeline({ orderId }: { orderId: string }) {
  const history = useOrderHistory(orderId)

  return (
    <Stack spacing={2}>
      <Typography variant="h3" component="h2">
        Histórico de status
      </Typography>
      {history.isLoading && (
        <Stack spacing={1}>
          <Skeleton height={58} />
          <Skeleton height={58} />
        </Stack>
      )}
      {history.isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={() => history.refetch()}>
              Tentar novamente
            </Button>
          }
        >
          {getOrderErrorMessage(history.error, 'Não foi possível carregar o histórico.')}
        </Alert>
      )}
      {history.isSuccess && history.data.length === 0 && (
        <Typography color="text.secondary">
          Ainda não há eventos no histórico deste pedido.
        </Typography>
      )}
      {history.isSuccess && history.data.length > 0 && (
        <Stack
          component="ol"
          spacing={0}
          divider={<Divider flexItem />}
          sx={{ listStyle: 'none', m: 0, p: 0 }}
          aria-label="Eventos reais do pedido"
        >
          {sortOrderHistory(history.data).map((event) => (
            <Stack
              component="li"
              key={event.id}
              direction="row"
              spacing={1.5}
              sx={{ py: 1.5, alignItems: 'flex-start' }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  bgcolor: 'primary.main',
                  borderRadius: '50%',
                  flex: '0 0 10px',
                  height: 10,
                  mt: 0.8,
                }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {event.previousStatus
                    ? `${orderStatusLabels[event.previousStatus]} → ${orderStatusLabels[event.newStatus]}`
                    : `Pedido ${orderStatusLabels[event.newStatus].toLocaleLowerCase('pt-BR')}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatOrderDate(event.changedAt)}
                </Typography>
                {event.changedBy && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    Responsável · {event.changedBy}
                  </Typography>
                )}
              </Box>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
