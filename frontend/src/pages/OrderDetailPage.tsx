import { Alert, Box, Button, Divider, Paper, Skeleton, Stack, Typography } from '@mui/material'
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CircleX,
  MapPin,
  Package,
  ReceiptText,
  UserRound,
} from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { PageHeading } from '../components/ui/PageHeading'
import { OrderStatusActions } from '../features/orders/components/OrderStatusActions'
import { OrderStatusChip } from '../features/orders/components/OrderStatusChip'
import { useOrder } from '../features/orders/hooks/useOrders'
import {
  formatCurrency,
  formatOrderDate,
  getOrderErrorMessage,
} from '../features/orders/utils/orderFormat'

type SectionTitleProps = {
  icon: React.ReactNode
  title: string
  description?: string
}

function SectionTitle({ icon, title, description }: SectionTitleProps) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
      <Box
        sx={(theme) => ({
          alignItems: 'center',
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 92, 92, 0.14)' : 'primary.light',
          borderRadius: 2,
          color: 'primary.main',
          display: 'flex',
          height: 38,
          justifyContent: 'center',
          width: 38,
        })}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="h3">{title}</Typography>
        {description && (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        )}
      </Box>
    </Stack>
  )
}

function DetailPaper({ children }: { children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
      {children}
    </Paper>
  )
}

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const query = useOrder(id)
  const created = Boolean((location.state as { created?: boolean } | null)?.created)

  return (
    <>
      <Button
        startIcon={<ArrowLeft size={18} />}
        sx={{ mb: 1, ml: -1, mt: -1 }}
        onClick={() => navigate('/orders')}
      >
        Voltar para pedidos
      </Button>
      <PageHeading
        title="Detalhes do pedido"
        description="Acompanhe os itens, a entrega e o andamento do pedido."
      />
      {created && (
        <Alert severity="success" sx={{ mb: 2.5 }}>
          Pedido criado com sucesso.
        </Alert>
      )}
      {query.isLoading && (
        <Stack spacing={2}>
          <Typography variant="caption" color="text.secondary">
            Identificador: <span>{id}</span>
          </Typography>
          <Skeleton variant="rounded" height={130} />
          <Skeleton variant="rounded" height={280} />
        </Stack>
      )}
      {query.isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={() => query.refetch()}>
              Tentar novamente
            </Button>
          }
        >
          {getOrderErrorMessage(query.error, 'Não foi possível carregar este pedido.')}
        </Alert>
      )}
      {query.data && (
        <Stack spacing={2.5}>
          <Paper
            variant="outlined"
            sx={(theme) => ({
              background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.primary.light} 180%)`,
              overflow: 'hidden',
              p: { xs: 2, sm: 2.5 },
            })}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
            >
              <Stack spacing={0.75}>
                <Typography variant="overline" color="text.secondary">
                  Pedido #{query.data.id.slice(0, 8)}
                </Typography>
                <Typography variant="h2">Pedido de {query.data.customer.name}</Typography>
                <Stack
                  direction="row"
                  spacing={0.75}
                  sx={{ alignItems: 'center', color: 'text.secondary' }}
                >
                  <CalendarClock size={16} aria-hidden="true" />
                  <Typography variant="body2">
                    Criado em {formatOrderDate(query.data.createdAt)}
                  </Typography>
                </Stack>
              </Stack>
              <OrderStatusChip status={query.data.status} />
            </Stack>
          </Paper>

          <Box
            sx={{
              display: 'grid',
              gap: 2.5,
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                lg: 'minmax(0, 1.7fr) minmax(280px, 0.9fr)',
              },
            }}
          >
            <Stack spacing={2.5}>
              <DetailPaper>
                <Stack spacing={2}>
                  <SectionTitle
                    icon={<Package size={20} aria-hidden="true" />}
                    title="Itens do pedido"
                    description={`${query.data.items.length} ${query.data.items.length === 1 ? 'item' : 'itens'} incluído${query.data.items.length === 1 ? '' : 's'}`}
                  />
                  <Stack divider={<Divider flexItem />}>
                    {query.data.items.map((item) => (
                      <Stack
                        key={item.id}
                        direction="row"
                        spacing={2}
                        sx={{ alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                            {item.productName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.quantity} × {formatCurrency(item.unitPrice)}
                          </Typography>
                        </Box>
                        <Typography sx={{ flexShrink: 0, fontWeight: 700 }}>
                          {formatCurrency(item.subtotal)}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </DetailPaper>

              <DetailPaper>
                <Stack spacing={2}>
                  <SectionTitle
                    icon={<MapPin size={20} aria-hidden="true" />}
                    title="Endereço de entrega"
                    description="Destino informado para este pedido"
                  />
                  <Box sx={{ pl: { sm: 6.5 } }}>
                    <Typography sx={{ fontWeight: 700 }}>
                      {query.data.deliveryAddress.street}, {query.data.deliveryAddress.number}
                      {query.data.deliveryAddress.complement
                        ? ` · ${query.data.deliveryAddress.complement}`
                        : ''}
                    </Typography>
                    <Typography color="text.secondary">
                      {query.data.deliveryAddress.neighborhood} · {query.data.deliveryAddress.city}/
                      {query.data.deliveryAddress.state}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      CEP {query.data.deliveryAddress.postalCode}
                    </Typography>
                  </Box>
                </Stack>
              </DetailPaper>
            </Stack>

            <Stack spacing={2.5}>
              <DetailPaper>
                <Stack spacing={2}>
                  <SectionTitle
                    icon={<ReceiptText size={20} aria-hidden="true" />}
                    title="Resumo"
                  />
                  <Divider />
                  <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">Subtotal</Typography>
                    <Typography>{formatCurrency(query.data.totalAmount)}</Typography>
                  </Stack>
                  <Stack
                    direction="row"
                    sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
                  >
                    <Typography variant="h3">Total</Typography>
                    <Typography variant="h2" color="primary.main">
                      {formatCurrency(query.data.totalAmount)}
                    </Typography>
                  </Stack>
                </Stack>
              </DetailPaper>

              <DetailPaper>
                <Stack spacing={2}>
                  <SectionTitle icon={<UserRound size={20} aria-hidden="true" />} title="Cliente" />
                  <Box sx={{ pl: { sm: 6.5 } }}>
                    <Typography sx={{ fontWeight: 700 }}>{query.data.customer.name}</Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {query.data.customer.email}
                    </Typography>
                  </Box>
                </Stack>
              </DetailPaper>

              {query.data.status === 'ENTREGUE' || query.data.status === 'CANCELADO' ? (
                <DetailPaper>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                    <Box
                      sx={{
                        alignItems: 'center',
                        bgcolor:
                          query.data.status === 'ENTREGUE'
                            ? 'rgba(74, 222, 128, 0.16)'
                            : 'rgba(251, 113, 133, 0.16)',
                        borderRadius: '50%',
                        color: query.data.status === 'ENTREGUE' ? '#4ade80' : '#fb7185',
                        display: 'flex',
                        flexShrink: 0,
                        height: 36,
                        justifyContent: 'center',
                        width: 36,
                      }}
                    >
                      {query.data.status === 'ENTREGUE' ? (
                        <CheckCircle2 size={20} aria-hidden="true" />
                      ) : (
                        <CircleX size={20} aria-hidden="true" />
                      )}
                    </Box>
                    <Box>
                      <Typography variant="h3">
                        {query.data.status === 'ENTREGUE' ? 'Pedido entregue' : 'Pedido cancelado'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {query.data.status === 'ENTREGUE'
                          ? 'Este pedido foi concluído e não possui mais ações pendentes.'
                          : 'Este pedido foi encerrado e não possui mais ações pendentes.'}
                      </Typography>
                    </Box>
                  </Stack>
                </DetailPaper>
              ) : (
                <DetailPaper>
                  <Stack spacing={1.5}>
                    <Typography variant="h3">Atualizar status</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avance o pedido conforme a entrega é preparada e concluída.
                    </Typography>
                    <OrderStatusActions order={query.data} />
                  </Stack>
                </DetailPaper>
              )}
            </Stack>
          </Box>
        </Stack>
      )}
    </>
  )
}
