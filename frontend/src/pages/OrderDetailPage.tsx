import { Alert, Box, Button, Divider, Paper, Skeleton, Stack, Typography } from '@mui/material'
import { ArrowLeft, CalendarClock, Package, ReceiptText, UserRound } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useRef } from 'react'
import { PageHeading } from '../components/ui/PageHeading'
import { OrderStatusActions } from '../features/orders/components/OrderStatusActions'
import { OrderStatusChip } from '../features/orders/components/OrderStatusChip'
import { OrderProgress } from '../features/orders/components/OrderProgress'
import { OrderStatusTimeline } from '../features/orders/components/OrderStatusTimeline'
import { OrderLocationCard } from '../features/orders/components/OrderLocationCard'
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
  const isValidId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const navigate = useNavigate()
  const location = useLocation()
  const historySectionRef = useRef<HTMLDivElement>(null)
  const scrollToHistory = () => {
    const section = historySectionRef.current
    if (!section) return
    section.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    section.focus({ preventScroll: true })
  }
  const query = useOrder(id, isValidId)
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
        title={query.data ? `Pedido #${query.data.id.slice(0, 8)}` : 'Detalhes do pedido'}
        description="Acompanhe os itens, a entrega e o andamento do pedido."
      />
      {!isValidId && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={() => navigate('/orders')}>
              Ver pedidos
            </Button>
          }
        >
          O identificador deste pedido não é válido.
        </Alert>
      )}
      {created && (
        <Alert severity="success" sx={{ mb: 2.5 }}>
          Pedido criado com sucesso.
        </Alert>
      )}
      {isValidId && query.isLoading && (
        <Stack spacing={2}>
          <Typography variant="caption" color="text.secondary">
            Identificador: <span>{id}</span>
          </Typography>
          <Skeleton variant="rounded" height={130} />
          <Skeleton variant="rounded" height={280} />
        </Stack>
      )}
      {isValidId && query.isError && (
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
      {isValidId && query.data && (
        <Stack spacing={2.5}>
          <Paper
            component="section"
            aria-label="Cabeçalho do pedido"
            variant="outlined"
            sx={(theme) => ({
              background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.primary.light} 180%)`,
              overflow: 'hidden',
              p: { xs: 2.5, sm: 3 },
            })}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{
                alignItems: { xs: 'stretch', sm: 'flex-start' },
                justifyContent: 'space-between',
              }}
            >
              <Stack spacing={1.5} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  Pedido {query.data.id}
                </Typography>
                <Typography variant="h2">Pedido #{query.data.id.slice(0, 8)}</Typography>
                <OrderStatusActions order={query.data} compact />
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
              <Stack sx={{ alignItems: { xs: 'flex-end', sm: 'flex-start' }, flexShrink: 0 }}>
                <OrderStatusChip status={query.data.status} />
              </Stack>
            </Stack>
          </Paper>

          <DetailPaper>
            <Stack spacing={1}>
              <OrderProgress status={query.data.status} onViewHistory={scrollToHistory} />
            </Stack>
          </DetailPaper>

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

              <OrderLocationCard
                order={query.data}
                onRefresh={() => void query.refetch()}
                isRefreshing={query.isFetching}
              />
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
                    <Typography color="text.secondary">Total dos itens</Typography>
                    <Typography>{formatCurrency(query.data.totalAmount)}</Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Atualizado em {formatOrderDate(query.data.updatedAt)}
                  </Typography>
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
                    <Typography sx={{ fontWeight: 700 }}>
                      {query.data.customer.name ?? 'Cliente não informado'}
                    </Typography>
                    {query.data.customer.phone && (
                      <Typography variant="body2" color="text.secondary">
                        {query.data.customer.phone.replace(
                          /^(\d{2})(\d{4,5})(\d{4})$/,
                          '($1) $2-$3',
                        )}
                      </Typography>
                    )}
                    {query.data.customer.email && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {query.data.customer.email}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </DetailPaper>
            </Stack>
          </Box>
          <Box
            id="order-status-history"
            ref={historySectionRef}
            tabIndex={-1}
            sx={{
              scrollMarginTop: 3,
              '&:focus': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
            }}
          >
            <DetailPaper>
              <OrderStatusTimeline orderId={query.data.id} />
            </DetailPaper>
          </Box>
        </Stack>
      )}
    </>
  )
}
