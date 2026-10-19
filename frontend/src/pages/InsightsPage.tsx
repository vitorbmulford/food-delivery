import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  IconButton,
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
  Activity,
  Award,
  Clock3,
  PackageCheck,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { PageHeading } from '../components/ui/PageHeading'
import { getOrderErrorMessage, formatCurrency } from '../features/orders/utils/orderFormat'
import { useInsights } from '../features/insights/useInsights'

type Preset = 'today' | 'yesterday' | '7' | '30' | '90' | 'month' | 'previousMonth' | 'custom'
const zone = 'America/Sao_Paulo'
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: zone,
})
const seriesColors = { created: '#3b82f6', delivered: '#16a36a', cancelled: '#dc5a5a' }
const countFormatter = new Intl.NumberFormat('pt-BR')

function todayBrazil() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
function shift(day: string, offset: number) {
  const year = Number(day.slice(0, 4))
  const month = Number(day.slice(5, 7))
  const date = Number(day.slice(8, 10))
  return new Date(Date.UTC(year, month - 1, date + offset)).toISOString().slice(0, 10)
}
function range(preset: Preset, today: string, customFrom: string, customTo: string) {
  if (preset === 'today') return { from: today, to: today }
  if (preset === 'yesterday') return { from: shift(today, -1), to: shift(today, -1) }
  if (preset === '7') return { from: shift(today, -6), to: today }
  if (preset === '30') return { from: shift(today, -29), to: today }
  if (preset === '90') return { from: shift(today, -89), to: today }
  if (preset === 'month') return { from: `${today.slice(0, 7)}-01`, to: today }
  if (preset === 'previousMonth') {
    const firstCurrent = `${today.slice(0, 7)}-01`
    const lastPrevious = shift(firstCurrent, -1)
    return { from: `${lastPrevious.slice(0, 7)}-01`, to: lastPrevious }
  }
  return { from: customFrom, to: customTo }
}
function dateLabel(day: string) {
  return dateFormatter.format(new Date(`${day}T12:00:00-03:00`))
}

type StackProps = ComponentProps<typeof MuiStack> & {
  alignItems?: string | Record<string, string>
  justifyContent?: string | Record<string, string>
  gap?: number | string | Record<string, number | string>
}
function Stack({ alignItems, justifyContent, gap, sx, ...props }: StackProps) {
  const extra = sx ? (Array.isArray(sx) ? sx : [sx]) : []
  return (
    <MuiStack {...props} sx={[{ alignItems, justifyContent, gap } as SxProps<Theme>, ...extra]} />
  )
}
type TypographyProps = ComponentProps<typeof Typography> & { fontWeight?: number | string }
function Text({ fontWeight, sx, ...props }: TypographyProps) {
  const extra = sx ? (Array.isArray(sx) ? sx : [sx]) : []
  return <Typography {...props} sx={[{ fontWeight } as SxProps<Theme>, ...extra]} />
}

function AnimatedValue({
  value,
  formatter,
}: {
  value: number
  formatter: (value: number) => string
}) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (reducedMotion) return
    const startedAt = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / 500, 1)
      setDisplay(value * (1 - (1 - progress) ** 3))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [reducedMotion, value])
  return <>{formatter(reducedMotion ? value : display)}</>
}

function Comparison({
  current,
  previous,
  inverse = false,
}: {
  current: number
  previous: number
  inverse?: boolean
}) {
  if (!previous)
    return (
      <Typography variant="caption" color="text.secondary">
        {current ? 'Sem base anterior para comparar' : 'Sem movimentação nos períodos'}
      </Typography>
    )
  const pct = ((current - previous) / previous) * 100
  if (!Number.isFinite(pct)) return null
  const positive = inverse ? pct < 0 : pct > 0
  const Icon = pct >= 0 ? TrendingUp : TrendingDown
  return (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      color={positive ? 'success.main' : 'error.main'}
    >
      <Icon size={15} />
      <Text variant="caption" fontWeight={600}>
        {Math.abs(pct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
      </Text>
      <Typography variant="caption" color="text.secondary">
        vs. período anterior
      </Typography>
    </Stack>
  )
}

function MetricCard({
  label,
  value,
  previous,
  icon: Icon,
  inverse = false,
  caption,
  animatedValue,
  formatter,
}: {
  label: string
  value: string
  previous?: [number, number]
  icon: typeof Activity
  inverse?: boolean
  caption?: string
  animatedValue?: number
  formatter?: (value: number) => string
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        transition: 'transform .18s ease, box-shadow .18s ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '&:hover': { transform: 'none' },
        },
      }}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Text variant="h5" sx={{ mt: 1, fontWeight: 700 }}>
              {animatedValue !== undefined && formatter ? (
                <AnimatedValue value={animatedValue} formatter={formatter} />
              ) : (
                value
              )}
            </Text>
          </Box>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              color: 'primary.main',
              bgcolor: 'action.hover',
              display: 'flex',
            }}
          >
            <Icon size={19} />
          </Box>
        </Stack>
        <Box sx={{ mt: 1.3 }}>
          {previous ? (
            <Comparison current={previous[0]} previous={previous[1]} inverse={inverse} />
          ) : (
            <Typography variant="caption" color="text.secondary">
              {caption}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, height: '100%' }}>
      <Text variant="h6" fontWeight={650}>
        {title}
      </Text>
      {subtitle && (
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      )}
      <Box sx={{ mt: 2 }}>{children}</Box>
    </Paper>
  )
}

function TrendChart({
  days,
}: {
  days: { date: string; createdValue: number; deliveredValue: number; cancelledValue: number }[]
}) {
  if (!days.some((d) => d.createdValue || d.deliveredValue || d.cancelledValue))
    return <Empty text="Sem valores no período selecionado." />
  const width = Math.max(520, days.length * 50)
  const height = 230
  const max = Math.max(
    1,
    ...days.flatMap((d) => [d.createdValue, d.deliveredValue, d.cancelledValue]),
  )
  const path = (key: 'createdValue' | 'deliveredValue' | 'cancelledValue') =>
    days
      .map(
        (d, i) =>
          `${i ? 'L' : 'M'}${((i * (width - 40)) / Math.max(days.length - 1, 1) + 20).toFixed(1)},${(height - 20 - (d[key] / max) * (height - 42)).toFixed(1)}`,
      )
      .join(' ')
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg
        role="img"
        aria-label="Evolução dos valores de pedidos criados, entregues e cancelados"
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ minWidth: 520 }}
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1="20"
              x2={width - 20}
              y1={height - 20 - f * (height - 42)}
              y2={height - 20 - f * (height - 42)}
              stroke="currentColor"
              opacity=".12"
            />
            <text x="2" y={height - 16 - f * (height - 42)} fontSize="9" fill="currentColor">
              {money.format(max * f).replace(',00', '')}
            </text>
          </g>
        ))}
        {(['createdValue', 'deliveredValue', 'cancelledValue'] as const).map((key) => (
          <path
            key={key}
            d={path(key)}
            fill="none"
            stroke={
              key === 'createdValue'
                ? seriesColors.created
                : key === 'deliveredValue'
                  ? seriesColors.delivered
                  : seriesColors.cancelled
            }
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        ))}
        {days.map((day, i) => (
          <g key={day.date}>
            <title>{`${dateLabel(day.date)} · Criados ${money.format(day.createdValue)} · Entregues ${money.format(day.deliveredValue)} · Cancelados ${money.format(day.cancelledValue)}`}</title>
            {(
              [
                ['Criados', day.createdValue, seriesColors.created],
                ['Entregues', day.deliveredValue, seriesColors.delivered],
                ['Cancelados', day.cancelledValue, seriesColors.cancelled],
              ] as const
            ).map(([name, value, color]) => (
              <Tooltip
                key={name}
                title={`${dateLabel(day.date)} · ${name}: ${money.format(value)}`}
                arrow
              >
                <circle
                  cx={(i * (width - 40)) / Math.max(days.length - 1, 1) + 20}
                  cy={height - 20 - (value / max) * (height - 42)}
                  r="4"
                  fill={color}
                  stroke="var(--mui-palette-background-paper, #fff)"
                  strokeWidth="1"
                  style={{ cursor: 'pointer' }}
                />
              </Tooltip>
            ))}
            <text
              x={(i * (width - 40)) / Math.max(days.length - 1, 1) + 20}
              y={height - 4}
              textAnchor="middle"
              fontSize="9"
              fill="currentColor"
            >
              {dateLabel(day.date)}
            </text>
          </g>
        ))}
      </svg>
      <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap' }}>
        {[
          ['Criados', seriesColors.created],
          ['Entregues', seriesColors.delivered],
          ['Cancelados', seriesColors.cancelled],
        ].map(([label, color]) => (
          <Typography key={label} variant="caption" sx={{ color, fontWeight: 600 }}>
            ● {label}
          </Typography>
        ))}
      </Stack>
    </Box>
  )
}

function VolumeChart({
  days,
}: {
  days: { date: string; createdCount: number; deliveredCount: number; cancelledCount: number }[]
}) {
  if (!days.some((day) => day.createdCount || day.deliveredCount || day.cancelledCount))
    return <Empty text="Sem pedidos no período selecionado." />
  const width = Math.max(520, days.length * 42)
  const height = 190
  const max = Math.max(
    1,
    ...days.flatMap((d) => [d.createdCount, d.deliveredCount, d.cancelledCount]),
  )
  const groupWidth = (width - 40) / days.length
  const barWidth = Math.max(2, Math.min(12, groupWidth / 5))
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg
        role="img"
        aria-label="Volume de pedidos criados, entregues e cancelados por dia"
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ minWidth: 520 }}
      >
        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            x1="20"
            x2={width - 20}
            y1={height - 20 - fraction * (height - 45)}
            y2={height - 20 - fraction * (height - 45)}
            stroke="currentColor"
            opacity=".12"
          />
        ))}
        {days.map((day, index) => {
          const center = 20 + groupWidth * index + groupWidth / 2
          const values = [day.createdCount, day.deliveredCount, day.cancelledCount]
          const colors = [seriesColors.created, seriesColors.delivered, seriesColors.cancelled]
          return (
            <g key={day.date}>
              <title>{`${dateLabel(day.date)} · ${day.createdCount} criados · ${day.deliveredCount} entregues · ${day.cancelledCount} cancelados`}</title>
              {values.map((value, series) => {
                const barHeight = (value / max) * (height - 45)
                return (
                  <Tooltip
                    key={series}
                    title={`${dateLabel(day.date)} · ${['Criados', 'Entregues', 'Cancelados'][series]}: ${value} pedido(s)`}
                    arrow
                  >
                    <rect
                      x={center + (series - 1) * (barWidth + 2) - barWidth / 2}
                      y={height - 20 - barHeight}
                      width={barWidth}
                      height={Math.max(barHeight, value ? 2 : 0)}
                      rx="2"
                      fill={colors[series]}
                      style={{ cursor: 'pointer' }}
                    />
                  </Tooltip>
                )
              })}
              {days.length <= 14 || index % Math.ceil(days.length / 14) === 0 ? (
                <text
                  x={center}
                  y={height - 4}
                  textAnchor="middle"
                  fontSize="9"
                  fill="currentColor"
                >
                  {dateLabel(day.date)}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap' }}>
        {[
          ['Criados', seriesColors.created],
          ['Entregues', seriesColors.delivered],
          ['Cancelados', seriesColors.cancelled],
        ].map(([label, color]) => (
          <Typography key={label} variant="caption" sx={{ color, fontWeight: 600 }}>
            ● {label}
          </Typography>
        ))}
      </Stack>
    </Box>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <Typography color="text.secondary" variant="body2" sx={{ py: 4, textAlign: 'center' }}>
      {text}
    </Typography>
  )
}

export function InsightsPage() {
  const today = useMemo(() => todayBrazil(), [])
  const [preset, setPreset] = useState<Preset>('30')
  const [customFrom, setCustomFrom] = useState(shift(today, -29))
  const [customTo, setCustomTo] = useState(today)
  const [productsOpen, setProductsOpen] = useState(false)
  const period = range(preset, today, customFrom, customTo)
  const invalid = !period.from || !period.to || period.from > period.to || period.to > today
  const query = useInsights(invalid ? '' : period.from, invalid ? '' : period.to)
  const data = query.data
  const current = data?.current
  const prior = data?.previous
  const maxStatusValue = Math.max(
    1,
    ...(data?.currentStatusValues.map((value) => value.value) ?? []),
  )
  const populatedHours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: data?.hourly.find((x) => x.hour === hour)?.count ?? 0,
  }))
  const maxHour = Math.max(1, ...populatedHours.map((x) => x.count))
  const peakHour = populatedHours.reduce(
    (best, hour) => (hour.count > best.count ? hour : best),
    populatedHours[0]!,
  )
  const totalHourlyOrders = populatedHours.reduce((sum, hour) => sum + hour.count, 0)
  return (
    <>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        gap={2}
        sx={{ mb: 3 }}
      >
        <PageHeading title="Insights" description="Análise comercial e desempenho da operação." />
        <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 230 }, mb: { md: 3.5 } }}>
          <InputLabel id="insights-period-label">Período</InputLabel>
          <Select
            labelId="insights-period-label"
            label="Período"
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
          >
            <MenuItem value="today">Hoje</MenuItem>
            <MenuItem value="yesterday">Ontem</MenuItem>
            <MenuItem value="7">Últimos 7 dias</MenuItem>
            <MenuItem value="30">Últimos 30 dias</MenuItem>
            <MenuItem value="90">Últimos 90 dias</MenuItem>
            <MenuItem value="month">Este mês</MenuItem>
            <MenuItem value="previousMonth">Mês anterior</MenuItem>
            <MenuItem value="custom">Personalizado</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      {preset === 'custom' && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} sx={{ mb: 2 }}>
          <TextField
            type="date"
            size="small"
            label="Data inicial"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
          />
          <TextField
            type="date"
            size="small"
            label="Data final"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today, min: customFrom } }}
          />
        </Stack>
      )}
      {invalid && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Informe um intervalo válido, com a data inicial anterior ou igual à data final.
        </Alert>
      )}
      {query.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getOrderErrorMessage(
            query.error,
            'Não foi possível carregar os Insights. Tente novamente.',
          )}
        </Alert>
      )}
      {query.isLoading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 6 }, (_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Skeleton variant="rounded" height={118} />
            </Grid>
          ))}
        </Grid>
      ) : data && current && prior ? (
        <Stack spacing={2.5}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <MetricCard
                label="Valor dos pedidos criados"
                value={formatCurrency(current.createdValue)}
                animatedValue={current.createdValue}
                formatter={formatCurrency}
                previous={[current.createdValue, prior.createdValue]}
                icon={ShoppingBag}
                caption={`${current.createdCount} pedidos criados`}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <MetricCard
                label="Valor dos pedidos entregues"
                value={formatCurrency(current.deliveredValue)}
                animatedValue={current.deliveredValue}
                formatter={formatCurrency}
                previous={[current.deliveredValue, prior.deliveredValue]}
                icon={PackageCheck}
                caption={`${current.deliveredCount} entregas concluídas`}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <MetricCard
                label="Valor cancelado"
                value={formatCurrency(current.cancelledValue)}
                animatedValue={current.cancelledValue}
                formatter={formatCurrency}
                previous={[current.cancelledValue, prior.cancelledValue]}
                inverse
                icon={TrendingDown}
                caption={`${current.cancelledCount} cancelamentos`}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <MetricCard
                label="Pedidos em andamento"
                value={formatCurrency(current.ongoingValue)}
                animatedValue={current.ongoingValue}
                formatter={formatCurrency}
                icon={Activity}
                caption="Valor atual de pedidos abertos"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <MetricCard
                label="Ticket médio entregue"
                value={formatCurrency(current.averageDeliveredTicket)}
                animatedValue={current.averageDeliveredTicket}
                formatter={formatCurrency}
                previous={[current.averageDeliveredTicket, prior.averageDeliveredTicket]}
                icon={ShoppingBag}
                caption="Média por pedido entregue"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <MetricCard
                label="Itens vendidos"
                value={current.itemsSold.toLocaleString('pt-BR')}
                animatedValue={current.itemsSold}
                formatter={countFormatter.format}
                previous={[current.itemsSold, prior.itemsSold]}
                icon={PackageCheck}
                caption="Itens em pedidos entregues"
              />
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Panel
                title="Evolução dos valores"
                subtitle="Criação usa a data do pedido; entrega e cancelamento usam a data do evento."
              >
                <TrendChart days={data.daily} />
              </Panel>
            </Grid>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Panel
                title="Volume de pedidos e entregas"
                subtitle="Criação e conclusão são contadas na data de seus respectivos eventos."
              >
                <VolumeChart days={data.daily} />
              </Panel>
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <Panel
                title="Pedidos por status atual"
                subtitle="Fotografia atual de todos os pedidos da conta."
              >
                {data.currentStatusValues.length ? (
                  <Stack spacing={1.5}>
                    {data.currentStatusValues.map((item) => (
                      <Box key={item.status}>
                        <Stack direction="row" justifyContent="space-between" gap={1}>
                          <Typography variant="body2">
                            {statusName(item.status)}{' '}
                            <Typography component="span" variant="caption" color="text.secondary">
                              ({item.count})
                            </Typography>
                          </Typography>
                          <Text variant="body2" fontWeight={600}>
                            {formatCurrency(item.value)}
                          </Text>
                        </Stack>
                        <Box sx={{ height: 5, mt: 0.6, borderRadius: 5, bgcolor: 'action.hover' }}>
                          <Tooltip
                            title={`${statusName(item.status)} · ${item.count} pedidos · ${formatCurrency(item.value)}`}
                            arrow
                          >
                            <Box
                              sx={{
                                height: '100%',
                                width: `${(item.value / maxStatusValue) * 100}%`,
                                borderRadius: 5,
                                bgcolor: statusColor(item.status),
                                minWidth: item.value ? 5 : 0,
                                cursor: 'pointer',
                              }}
                            />
                          </Tooltip>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Empty text="Ainda não há pedidos." />
                )}
              </Panel>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Panel
                title="Produtos mais vendidos"
                subtitle="Somente pedidos entregues; nomes agrupados após remover espaços repetidos e ignorar caixa."
              >
                {data.products.length ? (
                  <Stack spacing={1.25}>
                    {data.products.slice(0, 4).map((p, i) => {
                      const rankColor = ['#f4b740', '#9aa7b8', '#c98252', '#7784d6'][i]!
                      return (
                        <Box
                          key={p.name}
                          sx={{
                            p: 1.25,
                            borderRadius: 2.5,
                            bgcolor: 'action.hover',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Stack direction="row" alignItems="center" spacing={1.25}>
                            <Box
                              sx={{
                                width: 34,
                                height: 34,
                                flexShrink: 0,
                                display: 'grid',
                                placeItems: 'center',
                                borderRadius: 2,
                                bgcolor: `${rankColor}24`,
                                color: rankColor,
                              }}
                            >
                              {i < 3 ? (
                                <Award size={18} />
                              ) : (
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                  {i + 1}
                                </Typography>
                              )}
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Text variant="body2" fontWeight={700} noWrap title={p.name}>
                                {p.name}
                              </Text>
                              <Typography variant="caption" color="text.secondary">
                                {p.sharePercent.toLocaleString('pt-BR', {
                                  maximumFractionDigits: 1,
                                })}
                                % das unidades
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                              <Chip
                                size="small"
                                label={`${p.quantity} un.`}
                                sx={{
                                  fontWeight: 700,
                                  bgcolor: `${rankColor}24`,
                                  color: 'text.primary',
                                }}
                              />
                              <Typography
                                variant="caption"
                                sx={{ display: 'block', mt: 0.35, fontWeight: 650 }}
                              >
                                {formatCurrency(p.value)}
                              </Typography>
                            </Box>
                          </Stack>
                          <Box
                            sx={{
                              height: 5,
                              mt: 1,
                              overflow: 'hidden',
                              borderRadius: 9,
                              bgcolor: 'background.paper',
                            }}
                          >
                            <Box
                              sx={{
                                width: `${Math.min(p.sharePercent, 100)}%`,
                                height: '100%',
                                borderRadius: 9,
                                bgcolor: rankColor,
                              }}
                            />
                          </Box>
                        </Box>
                      )
                    })}
                    <Button
                      onClick={() => setProductsOpen(true)}
                      variant="outlined"
                      size="small"
                      sx={{
                        alignSelf: 'flex-start',
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 700,
                      }}
                    >
                      Ver ranking completo
                    </Button>
                  </Stack>
                ) : (
                  <Empty text="Nenhum produto entregue neste período." />
                )}
              </Panel>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Panel
                title="Horários de maior movimento"
                subtitle="Pedidos agrupados pela hora de criação no horário de Brasília."
              >
                {data.hourly.length ? (
                  <Box
                    sx={{
                      height: 220,
                      display: 'flex',
                      alignItems: 'end',
                      gap: 0.5,
                      overflowX: 'auto',
                      px: 1,
                    }}
                  >
                    {populatedHours.map((h) => (
                      <Tooltip
                        key={h.hour}
                        title={`${String(h.hour).padStart(2, '0')}h · ${h.count} pedidos`}
                        arrow
                      >
                        <Box
                          sx={{
                            minWidth: 8,
                            flex: 1,
                            height: `${Math.max(4, (h.count / maxHour) * 100)}%`,
                            bgcolor: h.count ? '#d94b4b' : 'action.disabledBackground',
                            opacity: h.count ? 1 : 0.55,
                            borderRadius: '5px 5px 0 0',
                            cursor: 'pointer',
                            transition: 'height .25s ease, filter .2s ease',
                            '&:hover': { filter: 'brightness(1.2)' },
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Box>
                ) : (
                  <Empty text="Sem pedidos no período." />
                )}
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    00h
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    06h
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    12h
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    18h
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    23h
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                  <Box
                    sx={{
                      flex: 1,
                      p: 1,
                      borderRadius: 2,
                      bgcolor: 'action.hover',
                      textAlign: 'center',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Horário de pico
                    </Typography>
                    <Text variant="body2" fontWeight={750}>
                      {totalHourlyOrders
                        ? `${String(peakHour.hour).padStart(2, '0')}h · ${peakHour.count} pedidos`
                        : 'Sem pedidos'}
                    </Text>
                  </Box>
                  <Box
                    sx={{
                      flex: 1,
                      p: 1,
                      borderRadius: 2,
                      bgcolor: 'action.hover',
                      textAlign: 'center',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Pedidos no período
                    </Typography>
                    <Text variant="body2" fontWeight={750}>
                      {countFormatter.format(totalHourlyOrders)}
                    </Text>
                  </Box>
                </Stack>
              </Panel>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Panel
                title="Tempos de desempenho"
                subtitle="Somente pedidos entregues no período, calculados com eventos registrados no histórico."
              >
                <Grid container spacing={2}>
                  {[
                    [
                      'Recebimento até preparo',
                      data.performance.receivedToPreparationMinutes,
                      data.performance.receivedToPreparationCount,
                    ],
                    [
                      'Tempo de preparo',
                      data.performance.preparationMinutes,
                      data.performance.preparationCount,
                    ],
                    [
                      'Em rota até entrega',
                      data.performance.deliveryMinutes,
                      data.performance.deliveryCount,
                    ],
                    [
                      'Criação até entrega',
                      data.performance.totalMinutes,
                      data.performance.totalCount,
                    ],
                  ].map(([label, minutes, count]) => (
                    <Grid key={String(label)} size={{ xs: 12, sm: 6, md: 3 }}>
                      <Stack direction="row" gap={1} alignItems="center">
                        <Clock3 size={17} color="#667085" />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {label}
                          </Typography>
                          <Text fontWeight={650}>
                            {count ? duration(Number(minutes)) : 'Dados insuficientes'}
                          </Text>
                          <Typography variant="caption" color="text.secondary">
                            {count} pedidos
                          </Typography>
                        </Box>
                      </Stack>
                    </Grid>
                  ))}
                </Grid>
              </Panel>
            </Grid>
          </Grid>
          <Typography variant="caption" color="text.secondary">
            Valores representam pedidos registrados, não comprovam pagamentos, recebimentos ou
            lucro. Comparação: intervalo imediatamente anterior com a mesma duração.
          </Typography>
        </Stack>
      ) : null}
      <Dialog
        open={productsOpen}
        onClose={() => setProductsOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="products-ranking-title"
        slotProps={{ paper: { sx: { overflow: 'hidden', borderRadius: 3 } } }}
      >
        <DialogTitle
          id="products-ranking-title"
          sx={{
            color: 'common.white',
            bgcolor: '#d94b4b',
            p: { xs: 2, sm: 2.5 },
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2.5,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'rgba(255,255,255,.18)',
              }}
            >
              <Award size={23} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Text id="products-ranking-title-text" variant="h6" fontWeight={750}>
                Ranking de produtos
              </Text>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.82)' }}>
                Mais unidades em pedidos entregues no período
              </Typography>
            </Box>
            <IconButton
              aria-label="Fechar ranking"
              onClick={() => setProductsOpen(false)}
              sx={{ color: 'white' }}
            >
              <X size={20} />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 1.5, sm: 2.5 }, maxHeight: '65vh' }}>
          <Stack spacing={1.25} sx={{ pt: 1 }}>
            {(data?.products ?? []).map((product, index) => {
              const rankColor = ['#e5a821', '#8c9bab', '#bd754b', '#6678cd'][index % 4]!
              return (
                <Box
                  key={product.name}
                  sx={{
                    p: 1.5,
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    background:
                      index < 3
                        ? `linear-gradient(100deg, ${rankColor}12, transparent 70%)`
                        : 'background.paper',
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        flexShrink: 0,
                        borderRadius: 2,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: `${rankColor}24`,
                        color: rankColor,
                        fontWeight: 800,
                      }}
                    >
                      {index < 3 ? <Award size={19} /> : index + 1}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Text variant="body2" fontWeight={720}>
                        {product.name}
                      </Text>
                      <Typography variant="caption" color="text.secondary">
                        {product.sharePercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                        % das unidades vendidas
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Chip
                        size="small"
                        label={`${countFormatter.format(product.quantity)} un.`}
                        sx={{ bgcolor: `${rankColor}24`, fontWeight: 750 }}
                      />
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.4, fontWeight: 700, color: 'success.main' }}
                      >
                        {formatCurrency(product.value)}
                      </Typography>
                    </Box>
                  </Stack>
                  <Box
                    sx={{
                      height: 5,
                      mt: 1.25,
                      borderRadius: 8,
                      overflow: 'hidden',
                      bgcolor: 'action.hover',
                    }}
                  >
                    <Box
                      sx={{
                        width: `${Math.min(product.sharePercent, 100)}%`,
                        height: '100%',
                        borderRadius: 8,
                        background: `linear-gradient(90deg, ${rankColor}, ${rankColor}99)`,
                      }}
                    />
                  </Box>
                </Box>
              )
            })}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            O valor mostra a soma dos itens vendidos; não representa confirmação de pagamento.
          </Typography>
        </DialogContent>
      </Dialog>
    </>
  )
}

function statusName(status: string) {
  return (
    (
      {
        RECEBIDO: 'Recebido',
        EM_PREPARO: 'Em preparo',
        SAIU_PARA_ENTREGA: 'Em entrega',
        ENTREGUE: 'Entregue',
        CANCELADO: 'Cancelado',
      } as Record<string, string>
    )[status] ?? status
  )
}
function statusColor(status: string) {
  return (
    (
      {
        RECEBIDO: '#d8872b',
        EM_PREPARO: '#6f63c2',
        SAIU_PARA_ENTREGA: '#3286ba',
        ENTREGUE: '#27835c',
        CANCELADO: '#cc5454',
      } as Record<string, string>
    )[status] ?? '#667085'
  )
}
function duration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 0) return 'Dados insuficientes'
  return minutes >= 60
    ? `${(minutes / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`
    : `${Math.round(minutes)} min`
}
