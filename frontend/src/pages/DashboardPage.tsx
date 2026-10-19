import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack as MuiStack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  type SxProps,
  type Theme,
} from '@mui/material'
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleAlert,
  ClipboardList,
  PackageCheck,
  PackageOpen,
  Timer,
  Truck,
  XCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { PageHeading } from '../components/ui/PageHeading'
import { useDashboard } from '../features/orders/hooks/useOrders'
import { orderStatusLabels, orderStatuses, type OrderStatus } from '../features/orders/types/order'
import type { DashboardDailyActivity } from '../features/orders/types/dashboard'
import './DashboardPage.css'

type StackProps = ComponentProps<typeof MuiStack> & {
  alignItems?: string | Record<string, string>
  justifyContent?: string | Record<string, string>
}
function Stack({ alignItems, justifyContent, sx, ...props }: StackProps) {
  const extraStyles = sx ? (Array.isArray(sx) ? sx : [sx]) : []
  return (
    <MuiStack {...props} sx={[{ alignItems, justifyContent } as SxProps<Theme>, ...extraStyles]} />
  )
}

type TypographyProps = ComponentProps<typeof Typography> & {
  fontWeight?: number | string
}
function DashboardTypography({ fontWeight, sx, ...props }: TypographyProps) {
  const extraStyles = sx ? (Array.isArray(sx) ? sx : [sx]) : []
  return <Typography {...props} sx={[{ fontWeight } as SxProps<Theme>, ...extraStyles]} />
}

function CountUp({ value, duration = 650 }: { value: number; duration?: number }) {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [displayValue, setDisplayValue] = useState(0)
  const currentValue = useRef(0)

  useEffect(() => {
    if (prefersReducedMotion) {
      currentValue.current = value
      return
    }

    const startValue = currentValue.current
    const startTime = performance.now()
    let frame = 0
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      const nextValue = Math.round(startValue + (value - startValue) * eased)
      currentValue.current = nextValue
      setDisplayValue(nextValue)
      if (progress < 1) frame = requestAnimationFrame(animate)
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [duration, prefersReducedMotion, value])

  return <span aria-label={String(value)}>{prefersReducedMotion ? value : displayValue}</span>
}

type Period = 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'custom'
const timezone = 'America/Sao_Paulo'
const statusColors: Record<OrderStatus, string> = {
  RECEBIDO: '#d8872b',
  EM_PREPARO: '#6f63c2',
  SAIU_PARA_ENTREGA: '#3286ba',
  ENTREGUE: '#27835c',
  CANCELADO: '#cc5454',
}
const statusIcons: Record<OrderStatus, typeof ClipboardList> = {
  RECEBIDO: PackageOpen,
  EM_PREPARO: Timer,
  SAIU_PARA_ENTREGA: Truck,
  ENTREGUE: PackageCheck,
  CANCELADO: XCircle,
}

function todayInBrazil() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function shiftDate(date: string, days: number) {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

function periodDates(period: Period, today: string, customFrom: string, customTo: string) {
  if (period === 'today') return { from: today, to: today }
  if (period === 'yesterday') {
    const yesterday = shiftDate(today, -1)
    return { from: yesterday, to: yesterday }
  }
  if (period === '7days') return { from: shiftDate(today, -6), to: today }
  if (period === '30days') return { from: shiftDate(today, -29), to: today }
  if (period === 'month') return { from: `${today.slice(0, 7)}-01`, to: today }
  return { from: customFrom, to: customTo }
}

function dateLabel(
  value: string,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' },
) {
  return new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: timezone }).format(
    new Date(`${value}T12:00:00-03:00`),
  )
}

function orderDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function StatusDistribution({
  counts,
  total,
}: {
  counts: Record<OrderStatus, number>
  total: number
}) {
  if (total === 0) return <EmptyChart message="Nenhum pedido criado neste período." />
  return (
    <Stack spacing={1.5}>
      <Box
        sx={{
          display: 'flex',
          height: 12,
          overflow: 'hidden',
          borderRadius: 10,
          bgcolor: 'action.hover',
        }}
        aria-label="Distribuição dos pedidos por status"
      >
        {orderStatuses.map((status) => (
          <Tooltip
            key={status}
            title={`${orderStatusLabels[status]}: ${counts[status]} pedidos (${Math.round((counts[status] / total) * 100)}%)`}
            arrow
          >
            <Box
              className="dashboard-status-segment"
              sx={{
                width: `${(counts[status] / total) * 100}%`,
                bgcolor: statusColors[status],
              }}
              aria-label={`${orderStatusLabels[status]}: ${counts[status]}`}
            />
          </Tooltip>
        ))}
      </Box>
      {orderStatuses.map((status) => {
        const Icon = statusIcons[status]
        return (
          <Stack key={status} direction="row" alignItems="center" spacing={1}>
            <Box sx={{ color: statusColors[status], display: 'flex' }}>
              <Icon size={16} />
            </Box>
            <Typography variant="body2" sx={{ flex: 1 }}>
              {orderStatusLabels[status]}
            </Typography>
            <DashboardTypography variant="body2" fontWeight={700}>
              <CountUp value={counts[status]} />
            </DashboardTypography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ width: 40, textAlign: 'right' }}
            >
              {Math.round((counts[status] / total) * 100)}%
            </Typography>
          </Stack>
        )
      })}
      <Typography variant="caption" color="text.secondary">
        Status atual dos pedidos criados no período selecionado.
      </Typography>
    </Stack>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <Box sx={{ minHeight: 150, display: 'grid', placeItems: 'center', textAlign: 'center', px: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  )
}

function DailyCreatedChart({ data }: { data: DashboardDailyActivity[] }) {
  const max = Math.max(...data.map((day) => day.created), 1)
  if (!data.some((day) => day.created > 0))
    return <EmptyChart message="Nenhum pedido criado neste período." />
  const width = Math.max(data.length * 8, 620)
  const chartHeight = 130
  const ticks =
    max <= 4
      ? Array.from({ length: max + 1 }, (_, value) => value)
      : [...new Set([0, Math.round(max / 3), Math.round((2 * max) / 3), max])]
  return (
    <Box sx={{ overflowX: 'auto', pb: 1 }}>
      <svg
        role="img"
        aria-label="Volume diário de pedidos criados"
        viewBox={`0 0 ${width} 190`}
        width="100%"
        style={{ minWidth: 620, display: 'block' }}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1="30"
              x2={width - 8}
              y1={147 - (tick / max) * chartHeight}
              y2={147 - (tick / max) * chartHeight}
              stroke="currentColor"
              opacity=".12"
            />
            <text
              x="24"
              y={151 - (tick / max) * chartHeight}
              textAnchor="end"
              fill="currentColor"
              opacity=".68"
              fontSize="10"
            >
              {tick}
            </text>
          </g>
        ))}
        {data.map((day, index) => {
          const barHeight = (day.created / max) * chartHeight
          const x = 34 + index * ((width - 44) / data.length)
          const barWidth = Math.max(3, ((width - 60) / data.length) * 0.58)
          return (
            <g key={day.date}>
              <title>
                {dateLabel(day.date, { day: 'numeric', month: 'long' })}: {day.created} pedidos
              </title>
              <Tooltip
                title={`${dateLabel(day.date, { day: 'numeric', month: 'long' })} · ${day.created} pedidos`}
                arrow
              >
                <rect
                  className="dashboard-chart-bar"
                  x={x}
                  y={147 - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx="3"
                  fill="#d94b4b"
                  opacity=".88"
                />
              </Tooltip>
              {(index === 0 ||
                index === data.length - 1 ||
                index === Math.floor(data.length / 2)) && (
                <text x={x} y="174" fill="currentColor" opacity=".62" fontSize="10">
                  {dateLabel(day.date)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </Box>
  )
}

function DailyEventsChart({ data }: { data: DashboardDailyActivity[] }) {
  const max = Math.max(...data.flatMap((day) => [day.delivered, day.cancelled]), 1)
  if (!data.some((day) => day.delivered > 0 || day.cancelled > 0))
    return <EmptyChart message="Nenhuma entrega concluída ou cancelamento neste período." />
  const width = Math.max(data.length * 8, 620)
  const ticks =
    max <= 4
      ? Array.from({ length: max + 1 }, (_, value) => value)
      : [...new Set([0, Math.round(max / 3), Math.round((2 * max) / 3), max])]
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={2}>
        <Typography
          variant="caption"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
        >
          <Box
            component="span"
            sx={{ width: 9, height: 9, borderRadius: 1, bgcolor: statusColors.ENTREGUE }}
          />{' '}
          Entregues
        </Typography>
        <Typography
          variant="caption"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
        >
          <Box
            component="span"
            sx={{ width: 9, height: 9, borderRadius: 1, bgcolor: statusColors.CANCELADO }}
          />{' '}
          Cancelados
        </Typography>
      </Stack>
      <Box sx={{ overflowX: 'auto', pb: 1 }}>
        <svg
          role="img"
          aria-label="Entregas e cancelamentos por dia, registrados pelo histórico de status"
          viewBox={`0 0 ${width} 190`}
          width="100%"
          style={{ minWidth: 620, display: 'block' }}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1="38"
                x2={width - 6}
                y1={147 - (tick / max) * 130}
                y2={147 - (tick / max) * 130}
                stroke="currentColor"
                opacity=".12"
              />
              <text
                x="30"
                y={151 - (tick / max) * 130}
                textAnchor="end"
                fill="currentColor"
                opacity=".68"
                fontSize="10"
              >
                {tick}
              </text>
            </g>
          ))}
          {data.map((day, index) => {
            const slot = (width - 46) / data.length
            const barWidth = Math.max(2, slot * 0.28)
            const x = 40 + index * slot
            const deliveredH = (day.delivered / max) * 130
            const cancelledH = (day.cancelled / max) * 130
            return (
              <g key={day.date}>
                <title>
                  {dateLabel(day.date, { day: 'numeric', month: 'long' })}: {day.delivered}{' '}
                  entregues, {day.cancelled} cancelados
                </title>
                <Tooltip
                  title={`${dateLabel(day.date, { day: 'numeric', month: 'long' })} · ${day.delivered} entregues`}
                  arrow
                >
                  <rect
                    className="dashboard-chart-bar"
                    x={x + slot * 0.18}
                    y={147 - deliveredH}
                    width={barWidth}
                    height={deliveredH}
                    rx="2"
                    fill={statusColors.ENTREGUE}
                  />
                </Tooltip>
                <Tooltip
                  title={`${dateLabel(day.date, { day: 'numeric', month: 'long' })} · ${day.cancelled} cancelados`}
                  arrow
                >
                  <rect
                    className="dashboard-chart-bar"
                    x={x + slot * 0.54}
                    y={147 - cancelledH}
                    width={barWidth}
                    height={cancelledH}
                    rx="2"
                    fill={statusColors.CANCELADO}
                  />
                </Tooltip>
                {(index === 0 ||
                  index === data.length - 1 ||
                  index === Math.floor(data.length / 2)) && (
                  <text x={x} y="174" fill="currentColor" opacity=".62" fontSize="10">
                    {dateLabel(day.date)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </Box>
    </Stack>
  )
}

export function DashboardPage() {
  const today = useMemo(() => todayInBrazil(), [])
  const [period, setPeriod] = useState<Period>('7days')
  const [customFrom, setCustomFrom] = useState(shiftDate(today, -6))
  const [customTo, setCustomTo] = useState(today)
  const dates = periodDates(period, today, customFrom, customTo)
  const invalidRange =
    !dates.from ||
    !dates.to ||
    dates.from > dates.to ||
    dates.to > today ||
    Date.parse(`${dates.to}T00:00:00Z`) - Date.parse(`${dates.from}T00:00:00Z`) > 365 * 86400000
  const query = useDashboard(invalidRange ? '' : dates.from, invalidRange ? '' : dates.to)
  const navigate = useNavigate()
  const data = query.data
  const total = data?.totalCreated ?? 0
  const statusCounts = data?.statusCounts
  const inProgress = statusCounts ? statusCounts.EM_PREPARO + statusCounts.SAIU_PARA_ENTREGA : 0
  const completedRate =
    total && statusCounts ? Math.round((statusCounts.ENTREGUE / total) * 100) : 0
  const cancelledRate =
    total && statusCounts ? Math.round((statusCounts.CANCELADO / total) * 100) : 0

  const cards = [
    {
      label: 'Pedidos criados',
      value: total,
      note: 'No período selecionado',
      Icon: ClipboardList,
      color: 'primary.main',
    },
    {
      label: 'Entregas concluídas',
      value: data?.deliveredInPeriod ?? 0,
      note: 'Registradas no período',
      Icon: PackageCheck,
      color: 'success.main',
    },
    {
      label: 'Cancelamentos',
      value: data?.cancelledInPeriod ?? 0,
      note: 'Registrados no período',
      Icon: XCircle,
      color: 'error.main',
    },
    {
      label: 'Em andamento',
      value: inProgress,
      note: 'Em preparo ou na rua agora',
      Icon: ArrowUpRight,
      color: 'info.main',
    },
    {
      label: 'Aguardando preparo',
      value: statusCounts?.RECEBIDO ?? 0,
      note: 'Pedidos recebidos no período',
      Icon: PackageOpen,
      color: 'warning.main',
    },
    {
      label: 'Em preparação',
      value: statusCounts?.EM_PREPARO ?? 0,
      note: 'Pedidos criados no período',
      Icon: Timer,
      color: 'secondary.main',
    },
    {
      label: 'Saiu para entrega',
      value: statusCounts?.SAIU_PARA_ENTREGA ?? 0,
      note: 'Pedidos criados no período',
      Icon: Truck,
      color: 'info.main',
    },
  ]

  return (
    <>
      <PageHeading
        title="Visão geral"
        description="Acompanhe o ritmo dos pedidos e as entregas da operação."
      />
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, mb: 2.5 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ md: 'center' }}
          justifyContent="space-between"
        >
          <Box>
            <DashboardTypography variant="subtitle1" fontWeight={700}>
              Período do painel
            </DashboardTypography>
            <Typography variant="caption" color="text.secondary">
              Datas no fuso de Brasília (America/Sao_Paulo)
            </Typography>
          </Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            alignItems={{ sm: 'center' }}
          >
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="dashboard-period-label">Período</InputLabel>
              <Select
                labelId="dashboard-period-label"
                label="Período"
                value={period}
                onChange={(event) => setPeriod(event.target.value as Period)}
              >
                <MenuItem value="today">Hoje</MenuItem>
                <MenuItem value="yesterday">Ontem</MenuItem>
                <MenuItem value="7days">Últimos 7 dias</MenuItem>
                <MenuItem value="30days">Últimos 30 dias</MenuItem>
                <MenuItem value="month">Este mês</MenuItem>
                <MenuItem value="custom">Personalizado</MenuItem>
              </Select>
            </FormControl>
            {period === 'custom' && (
              <Stack direction="row" spacing={1}>
                <TextField
                  label="De"
                  type="date"
                  size="small"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
                />
                <TextField
                  label="Até"
                  type="date"
                  size="small"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
                />
              </Stack>
            )}
            {period !== 'custom' && (
              <Chip
                size="small"
                variant="outlined"
                label={`${dateLabel(dates.from, { day: '2-digit', month: 'short', year: 'numeric' })} – ${dateLabel(dates.to, { day: '2-digit', month: 'short', year: 'numeric' })}`}
              />
            )}
          </Stack>
        </Stack>
      </Paper>
      {query.isFetching && data && (
        <Typography
          variant="caption"
          color="text.secondary"
          role="status"
          sx={{ display: 'block', mt: -1.5, mb: 1.5 }}
        >
          Atualizando indicadores…
        </Typography>
      )}
      {invalidRange && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Escolha um intervalo válido de até 366 dias, sem datas futuras.
        </Alert>
      )}
      {query.isError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          }
        >
          Não foi possível carregar os indicadores operacionais.
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'repeat(3, minmax(0, 1fr))',
            xl: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 1.5,
          mb: 2.5,
        }}
      >
        {cards.map(({ label, value, note, Icon, color }) => (
          <Card key={label} variant="outlined" className="dashboard-metric-card" title={note}>
            <CardContent
              sx={{ p: { xs: 1.75, sm: 2.25 }, '&:last-child': { pb: { xs: 1.75, sm: 2.25 } } }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
                spacing={1}
              >
                <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40 }}>
                  {label}
                </Typography>
                <Box
                  sx={{ color, bgcolor: 'action.hover', p: 0.8, display: 'flex', borderRadius: 2 }}
                >
                  <Icon size={17} />
                </Box>
              </Stack>
              {query.isLoading ? (
                <Skeleton width="42%" height={44} />
              ) : (
                <Typography variant="h2" sx={{ mt: 0.4, mb: 0.75 }}>
                  <CountUp value={value} />
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {note}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
      {!query.isLoading && !query.isError && total > 0 && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
          <Paper variant="outlined" sx={{ px: 2, py: 1.5, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ArrowUpRight size={18} color="#27835c" />
              <Typography variant="body2" color="text.secondary">
                Taxa de conclusão
              </Typography>
              <DashboardTypography fontWeight={800} sx={{ ml: 'auto !important' }}>
                <CountUp value={completedRate} />%
              </DashboardTypography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Pedidos criados no período que estão entregues.
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ px: 2, py: 1.5, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ArrowDownRight size={18} color="#cc5454" />
              <Typography variant="body2" color="text.secondary">
                Taxa de cancelamento
              </Typography>
              <DashboardTypography fontWeight={800} sx={{ ml: 'auto !important' }}>
                <CountUp value={cancelledRate} />%
              </DashboardTypography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Pedidos criados no período que estão cancelados.
            </Typography>
          </Paper>
        </Stack>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(300px, .85fr)' },
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
          <Typography variant="h3" sx={{ mb: 0.5 }}>
            Volume diário de pedidos
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Pedidos criados em cada dia do período.
          </Typography>
          <Box sx={{ mt: 2 }}>
            {query.isLoading ? (
              <Skeleton variant="rounded" height={190} />
            ) : data ? (
              <DailyCreatedChart data={data.dailyActivity} />
            ) : null}
          </Box>
        </Paper>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
          <Typography variant="h3" sx={{ mb: 0.5 }}>
            Pedidos por status
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Distribuição atual dos pedidos criados no período.
          </Typography>
          <Box sx={{ mt: 2 }}>
            {query.isLoading ? (
              <Skeleton variant="rounded" height={190} />
            ) : statusCounts ? (
              <StatusDistribution counts={statusCounts} total={total} />
            ) : null}
          </Box>
        </Paper>
      </Box>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, mb: 1.5, minWidth: 0 }}>
        <Typography variant="h3" sx={{ mb: 0.5 }}>
          Entregas e cancelamentos
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Eventos agrupados pela data em que a mudança de status foi registrada.
        </Typography>
        <Box sx={{ mt: 2 }}>
          {query.isLoading ? (
            <Skeleton variant="rounded" height={190} />
          ) : data ? (
            <DailyEventsChart data={data.dailyActivity} />
          ) : null}
        </Box>
      </Paper>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.5 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1.5 }}
          >
            <Box>
              <Typography variant="h3">Pedidos recentes</Typography>
              <Typography variant="caption" color="text.secondary">
                Criados no período selecionado.
              </Typography>
            </Box>
            <Button size="small" onClick={() => navigate('/orders')}>
              Ver todos
            </Button>
          </Stack>
          {query.isLoading ? (
            <Stack spacing={1}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={46} />
              ))}
            </Stack>
          ) : data?.recentOrders.length ? (
            <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
              {data.recentOrders.map((order) => (
                <Stack
                  key={order.id}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ py: 1.15 }}
                >
                  <DashboardTypography variant="body2" fontWeight={700} sx={{ flex: 1 }}>
                    #{order.id.slice(0, 8)}
                  </DashboardTypography>
                  <Typography variant="caption" color="text.secondary">
                    {orderDateTimeLabel(order.createdAt)}
                  </Typography>
                  <Chip
                    size="small"
                    label={orderStatusLabels[order.status]}
                    sx={{
                      bgcolor: `${statusColors[order.status]}18`,
                      color: statusColors[order.status],
                      fontWeight: 600,
                    }}
                  />
                  <Button
                    size="small"
                    aria-label={`Abrir pedido ${order.id.slice(0, 8)}`}
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    Abrir
                  </Button>
                </Stack>
              ))}
            </Stack>
          ) : (
            <EmptyChart message="Nenhum pedido encontrado no período." />
          )}
        </Paper>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1.5 }}
          >
            <Box>
              <Typography variant="h3">Pedidos em andamento</Typography>
              <Typography variant="caption" color="text.secondary">
                Todos os pedidos abertos que precisam de acompanhamento.
              </Typography>
            </Box>
            <CircleAlert size={19} color="#d8872b" />
          </Stack>
          {query.isLoading ? (
            <Stack spacing={1}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={46} />
              ))}
            </Stack>
          ) : data?.ongoingOrders.length ? (
            <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
              {data.ongoingOrders.map((order) => (
                <Stack
                  key={order.id}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ py: 1.15 }}
                >
                  <DashboardTypography variant="body2" fontWeight={700} sx={{ flex: 1 }}>
                    #{order.id.slice(0, 8)}
                  </DashboardTypography>
                  <Chip
                    size="small"
                    label={orderStatusLabels[order.status]}
                    sx={{
                      bgcolor: `${statusColors[order.status]}18`,
                      color: statusColors[order.status],
                      fontWeight: 600,
                    }}
                  />
                  <Button
                    size="small"
                    aria-label={`Acompanhar pedido ${order.id.slice(0, 8)}`}
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    Acompanhar
                  </Button>
                </Stack>
              ))}
            </Stack>
          ) : (
            <EmptyChart message="Não há pedidos em andamento. Tudo em dia!" />
          )}
        </Paper>
      </Box>
    </>
  )
}
