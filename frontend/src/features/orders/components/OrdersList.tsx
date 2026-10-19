import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { CheckCircle2, CircleX } from 'lucide-react'
import { Link } from 'react-router'
import type { Order, OrderStatus } from '../types/order'
import { orderStatusLabels } from '../types/order'
import { formatCurrency, formatOrderDate } from '../utils/orderFormat'
import { OrderStatusChip } from './OrderStatusChip'
import { OrderStatusActions } from './OrderStatusActions'

type Props = {
  orders: Order[]
  loading: boolean
  error: boolean
  page: number
  totalPages: number
  totalElements: number
  status: OrderStatus | ''
  onStatusChange: (status: OrderStatus | '') => void
  onPageChange: (page: number) => void
  onRetry: () => void
  onCreate: () => void
}

function ItemsSummary({ order }: { order: Order }) {
  return (
    <Stack spacing={0.75}>
      {order.items.slice(0, 2).map((item) => (
        <Stack
          key={item.id}
          direction="row"
          spacing={0.75}
          sx={{ alignItems: 'center', minWidth: 0 }}
        >
          <Box
            component="span"
            sx={{
              bgcolor: 'action.hover',
              borderRadius: 1,
              color: 'text.secondary',
              flexShrink: 0,
              fontSize: '0.75rem',
              fontWeight: 700,
              px: 0.75,
              py: 0.25,
            }}
          >
            {item.quantity} un.
          </Box>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {item.productName}
          </Typography>
        </Stack>
      ))}
      {order.items.length > 2 && (
        <Typography variant="caption" color="text.secondary">
          +{order.items.length - 2} itens
        </Typography>
      )}
    </Stack>
  )
}

function ActionsCell({ order }: { order: Order }) {
  if (order.status === 'ENTREGUE' || order.status === 'CANCELADO') {
    const delivered = order.status === 'ENTREGUE'
    return (
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'text.secondary' }}>
        {delivered ? (
          <CheckCircle2 size={16} aria-hidden="true" />
        ) : (
          <CircleX size={16} aria-hidden="true" />
        )}
        <Typography variant="body2">{delivered ? 'Concluído' : 'Encerrado'}</Typography>
      </Stack>
    )
  }

  return <OrderStatusActions order={order} />
}

export function OrdersList(props: Props) {
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [retrying, setRetrying] = useState(false)
  const retry = async () => {
    setRetrying(true)
    try {
      await props.onRetry()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <Stack spacing={2.5}>
      <Card variant="outlined">
        <CardContent sx={{ '&:last-child': { pb: 2 }, py: 2 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
          >
            <FormControl size="small" sx={{ minWidth: { sm: 240 } }}>
              <InputLabel id="order-status-filter-label">Status</InputLabel>
              <Select
                labelId="order-status-filter-label"
                label="Status"
                value={props.status}
                onChange={(event) => props.onStatusChange(event.target.value as OrderStatus | '')}
              >
                <MenuItem value="">Todos os status</MenuItem>
                {Object.entries(orderStatusLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {!props.loading && !props.error && (
              <Typography variant="body2" color="text.secondary">
                {props.totalElements} pedido{props.totalElements === 1 ? '' : 's'} encontrado
                {props.totalElements === 1 ? '' : 's'}
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      {props.loading && (
        <Stack aria-label="Carregando pedidos" spacing={1}>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} variant="rounded" height={mobile ? 145 : 58} />
          ))}
        </Stack>
      )}

      {props.error && !props.loading && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={retrying ? <CircularProgress size={14} /> : undefined}
              disabled={retrying}
              onClick={retry}
            >
              Tentar novamente
            </Button>
          }
        >
          Não foi possível carregar os pedidos.
        </Alert>
      )}

      {!props.loading && !props.error && props.orders.length === 0 && (
        <Card variant="outlined">
          <CardContent sx={{ py: 5, textAlign: 'center' }}>
            <Typography variant="h3" gutterBottom>
              Nenhum pedido encontrado
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {props.status
                ? 'Tente outro status ou crie um novo pedido.'
                : 'Seus pedidos aparecerão aqui após a criação.'}
            </Typography>
            <Button variant="contained" onClick={props.onCreate}>
              Novo pedido
            </Button>
          </CardContent>
        </Card>
      )}

      {!props.loading &&
        !props.error &&
        props.orders.length > 0 &&
        (mobile ? (
          <Stack spacing={1.5}>
            {props.orders.map((order) => (
              <Card key={order.id} variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}
                    >
                      <Typography
                        component={Link}
                        to={`/orders/${order.id}`}
                        sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}
                      >
                        Pedido {order.id.slice(0, 8)}
                      </Typography>
                      <OrderStatusChip status={order.status} />
                    </Stack>
                    <ItemsSummary order={order} />
                    <Typography variant="body2" color="text.secondary">
                      Criado em {formatOrderDate(order.createdAt)}
                    </Typography>
                    <Typography variant="body2">{order.customer.name}</Typography>
                    <Typography sx={{ fontWeight: 700 }}>
                      {formatCurrency(order.totalAmount)}
                    </Typography>
                    <ActionsCell order={order} />
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        ) : (
          <Box
            sx={{
              overflowX: 'auto',
              border: 1,
              borderColor: 'divider',
              borderRadius: 3,
              bgcolor: 'background.paper',
            }}
          >
            <Table
              aria-label="Pedidos"
              sx={{
                minWidth: 1080,
                '& .MuiTableCell-root': { borderColor: 'divider', px: 2.5, py: 2.25 },
                '& .MuiTableHead-root .MuiTableCell-root': {
                  bgcolor: 'action.hover',
                  color: 'text.secondary',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Pedido</TableCell>
                  <TableCell>Cliente</TableCell>
                  <TableCell>Itens</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Ações</TableCell>
                  <TableCell>Criado em</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {props.orders.map((order) => (
                  <TableRow key={order.id} hover>
                    <TableCell>
                      <Typography
                        component={Link}
                        to={`/orders/${order.id}`}
                        sx={{ fontWeight: 700 }}
                      >
                        {order.id.slice(0, 8)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{order.customer.name}</TableCell>
                    <TableCell>
                      <ItemsSummary order={order} />
                    </TableCell>
                    <TableCell>{formatCurrency(order.totalAmount)}</TableCell>
                    <TableCell>
                      <OrderStatusChip status={order.status} />
                    </TableCell>
                    <TableCell>
                      <ActionsCell order={order} />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                      {formatOrderDate(order.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ))}

      {!props.loading && !props.error && props.totalPages > 1 && (
        <Stack sx={{ alignItems: 'center', py: 1 }}>
          <Pagination
            count={props.totalPages}
            page={props.page + 1}
            onChange={(_, value) => props.onPageChange(value - 1)}
            color="primary"
            aria-label="Paginação de pedidos"
          />
        </Stack>
      )}
    </Stack>
  )
}
