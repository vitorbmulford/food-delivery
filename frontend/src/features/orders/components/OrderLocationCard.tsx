import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import { MapPin, MousePointer2, RefreshCw } from 'lucide-react'
import type { Order } from '../types/order'
import { useRequestOrderGeocoding, useSetManualOrderLocation } from '../hooks/useOrders'
import { getOrderErrorMessage } from '../utils/orderFormat'

const OrderMap = lazy(() => import('./OrderMap').then((module) => ({ default: module.OrderMap })))

type OrderLocationCardProps = {
  order: Order
  onRefresh: () => void
  isRefreshing: boolean
}

function isValidCoordinates(
  coordinates: { latitude: number; longitude: number } | null,
): coordinates is { latitude: number; longitude: number } {
  return Boolean(
    coordinates &&
    Number.isFinite(coordinates.latitude) &&
    coordinates.latitude >= -90 &&
    coordinates.latitude <= 90 &&
    Number.isFinite(coordinates.longitude) &&
    coordinates.longitude >= -180 &&
    coordinates.longitude <= 180,
  )
}

function hasValidCoordinates(order: Order): order is Order & {
  coordinates: { latitude: number; longitude: number }
} {
  return isValidCoordinates(order.coordinates)
}

function suggestionDescription(level: Order['geocodingSuggestionLevel']) {
  switch (level) {
    case 'STREET':
      return 'uma referência aproximada da rua'
    case 'NEIGHBORHOOD':
      return 'o centro aproximado do bairro'
    case 'POSTAL_CODE':
      return 'uma referência aproximada do CEP'
    default:
      return 'uma referência aproximada'
  }
}

function addressLines(order: Order) {
  const address = order.deliveryAddress
  return [
    `${address.street}, ${address.number}${address.complement ? ` · ${address.complement}` : ''}`,
    `${address.neighborhood} · ${address.city}/${address.state}`,
    `CEP ${address.postalCode}`,
  ]
}

function statusInfo(
  status: string,
  coordinateSource: Order['coordinateSource'],
  hasSuggestion: boolean,
) {
  switch (status) {
    case 'PENDING':
      return {
        label: 'Localizando endereço',
        color: 'info' as const,
        message: 'O endereço está sendo localizado.',
      }
    case 'SUCCESS':
      return {
        label:
          coordinateSource === 'MANUAL'
            ? 'Localização definida manualmente'
            : 'Localização encontrada',
        color: 'success' as const,
        message: '',
      }
    case 'NOT_FOUND':
      return {
        label: 'Endereço não localizado',
        color: 'warning' as const,
        message: hasSuggestion
          ? 'O endereço exato não foi localizado. Encontramos uma referência aproximada para iniciar a seleção manual.'
          : 'O endereço exato não foi localizado e nenhuma referência compatível foi encontrada. O pedido continua disponível sem coordenadas.',
      }
    case 'FAILED':
      return {
        label: 'Falha ao localizar',
        color: 'error' as const,
        message: 'Ocorreu uma falha ao consultar a localização. Tente novamente mais tarde.',
      }
    default:
      return {
        label: 'Status indisponível',
        color: 'default' as const,
        message:
          'O status da localização não é reconhecido. O endereço informado continua disponível acima.',
      }
  }
}

class MapErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

export function OrderLocationCard({ order, onRefresh, isRefreshing }: OrderLocationCardProps) {
  const retry = useRequestOrderGeocoding()
  const manualLocation = useSetManualOrderLocation()
  const [accepted, setAccepted] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [manualAdjusted, setManualAdjusted] = useState(false)
  const autoOpenedSuggestion = useRef<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const canRetry = order.geocodingStatus === 'NOT_FOUND' || order.geocodingStatus === 'FAILED'
  const coordinates = hasValidCoordinates(order) ? order.coordinates : null
  const suggestedCoordinates = isValidCoordinates(order.suggestedCoordinates)
    ? order.suggestedCoordinates
    : null
  const status = statusInfo(
    order.geocodingStatus,
    order.coordinateSource,
    suggestedCoordinates !== null,
  )
  const lines = addressLines(order)
  const suggestionKey = suggestedCoordinates
    ? `${order.id}:${order.geocodingStatus}:${order.geocodingSuggestionLevel}:${suggestedCoordinates.latitude}:${suggestedCoordinates.longitude}`
    : null

  useEffect(() => {
    if (order.geocodingStatus !== 'NOT_FOUND' || !suggestedCoordinates || !suggestionKey) {
      if (order.geocodingStatus !== 'NOT_FOUND') autoOpenedSuggestion.current = null
      return
    }
    if (autoOpenedSuggestion.current === suggestionKey) return

    autoOpenedSuggestion.current = suggestionKey
    setSelectedPoint(suggestedCoordinates)
    setManualAdjusted(false)
    setManualMode(true)
  }, [order.geocodingStatus, suggestedCoordinates, suggestionKey])

  async function requestRetry() {
    setAccepted(false)
    try {
      const responseStatus = await retry.mutateAsync(order.id)
      if (responseStatus === 202) setAccepted(true)
    } catch {
      // The mutation error is rendered below with a safe, user-facing message.
    }
  }

  async function confirmManualLocation() {
    if (!selectedPoint) return
    try {
      await manualLocation.mutateAsync({ id: order.id, coordinates: selectedPoint })
      setManualMode(false)
      setSelectedPoint(null)
    } catch {
      // The mutation error is rendered below with a safe, user-facing message.
    }
  }

  function startManualSelection() {
    manualLocation.reset()
    setSelectedPoint(suggestedCoordinates)
    setManualAdjusted(false)
    setManualMode(true)
  }

  return (
    <Paper
      component="section"
      aria-labelledby="order-location-title"
      variant="outlined"
      sx={{ p: { xs: 2, sm: 2.5 } }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Box
              sx={(theme) => ({
                alignItems: 'center',
                bgcolor:
                  theme.palette.mode === 'dark' ? 'rgba(255, 92, 92, 0.14)' : 'primary.light',
                borderRadius: 2,
                color: 'primary.main',
                display: 'flex',
                height: 38,
                justifyContent: 'center',
                width: 38,
              })}
            >
              <MapPin size={20} aria-hidden="true" />
            </Box>
            <Box>
              <Typography id="order-location-title" variant="h3">
                Localização da entrega
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Endereço informado para este pedido
              </Typography>
            </Box>
          </Stack>
          <Chip label={status.label} color={status.color} size="small" />
        </Stack>

        <Box sx={{ pl: { sm: 6.5 } }}>
          {lines.map((line) => (
            <Typography
              key={line}
              color={line.startsWith('CEP') ? 'text.secondary' : undefined}
              variant={line.startsWith('CEP') ? 'body2' : 'body1'}
              sx={{ overflowWrap: 'anywhere' }}
            >
              {line}
            </Typography>
          ))}
        </Box>

        {order.geocodingStatus === 'PENDING' && (
          <Alert severity="info" icon={<CircularProgress size={18} />}>
            {status.message}
          </Alert>
        )}
        {status.message && order.geocodingStatus !== 'PENDING' && (
          <Alert severity={status.color === 'default' ? 'info' : status.color}>
            {status.message}
          </Alert>
        )}

        {coordinates && order.geocodingStatus === 'SUCCESS' && (
          <>
            <Box
              sx={{
                borderRadius: 1.5,
                height: { xs: 280, sm: 340 },
                overflow: 'hidden',
                position: 'relative',
                bgcolor: 'action.hover',
              }}
            >
              <MapErrorBoundary
                fallback={
                  <Alert severity="warning" sx={{ m: 2 }}>
                    O mapa não pôde ser carregado. As coordenadas continuam disponíveis abaixo.
                  </Alert>
                }
              >
                <Suspense fallback={<Skeleton variant="rounded" height="100%" />}>
                  <OrderMap
                    latitude={coordinates.latitude}
                    longitude={coordinates.longitude}
                    markerLabel={
                      order.coordinateSource === 'MANUAL'
                        ? 'Ponto de entrega confirmado manualmente'
                        : 'Endereço geocodificado da entrega'
                    }
                  />
                </Suspense>
              </MapErrorBoundary>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Latitude {coordinates.latitude}, longitude {coordinates.longitude}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {order.coordinateSource === 'MANUAL'
                ? 'O marcador representa o ponto de entrega confirmado manualmente.'
                : 'O marcador representa o endereço geocodificado da entrega.'}{' '}
              Não representa a posição em tempo real do entregador. Mapa © OpenStreetMap
              contributors.
            </Typography>
          </>
        )}

        {order.geocodingStatus === 'SUCCESS' && !coordinates && (
          <Alert severity="warning">
            A geocodificação foi concluída, mas as coordenadas retornadas são inválidas ou estão
            ausentes.
          </Alert>
        )}

        {accepted && order.geocodingStatus === 'PENDING' && (
          <Alert severity="success">
            Nova solicitação aceita. A localização será atualizada automaticamente enquanto o
            processamento estiver pendente.
          </Alert>
        )}
        {manualMode && order.geocodingStatus === 'NOT_FOUND' && (
          <>
            <Alert severity="info">
              {suggestedCoordinates
                ? `O mapa foi centralizado usando ${suggestionDescription(order.geocodingSuggestionLevel)}, com compatibilidade validada para ${order.deliveryAddress.city}/${order.deliveryAddress.state}. Essa referência não é o destino exato e não foi confirmada automaticamente. Ajuste o marcador se necessário e confirme o ponto correto.`
                : 'Não encontramos uma referência compatível para centralizar o mapa. Navegue e clique no ponto correto da entrega.'}{' '}
              O endereço postal acima será preservado.
            </Alert>
            <Box
              sx={{
                borderRadius: 1.5,
                height: { xs: 280, sm: 340 },
                overflow: 'hidden',
                position: 'relative',
                bgcolor: 'action.hover',
              }}
            >
              <MapErrorBoundary
                fallback={
                  <Alert severity="warning" sx={{ m: 2 }}>
                    O mapa de seleção não pôde ser carregado. Tente novamente mais tarde.
                  </Alert>
                }
              >
                <Suspense fallback={<Skeleton variant="rounded" height="100%" />}>
                  <OrderMap
                    latitude={selectedPoint?.latitude}
                    longitude={selectedPoint?.longitude}
                    markerLabel={
                      suggestedCoordinates && !manualAdjusted
                        ? 'Referência aproximada para ajuste'
                        : 'Ponto selecionado manualmente'
                    }
                    onSelect={(point) => {
                      setSelectedPoint(point)
                      setManualAdjusted(true)
                    }}
                  />
                </Suspense>
              </MapErrorBoundary>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {selectedPoint
                ? suggestedCoordinates && !manualAdjusted
                  ? `Referência aproximada: latitude ${selectedPoint.latitude.toFixed(6)}, longitude ${selectedPoint.longitude.toFixed(6)}`
                  : `Ponto selecionado: latitude ${selectedPoint.latitude.toFixed(6)}, longitude ${selectedPoint.longitude.toFixed(6)}`
                : 'Nenhum ponto selecionado.'}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                variant="contained"
                disabled={!selectedPoint || manualLocation.isPending}
                onClick={confirmManualLocation}
              >
                {manualLocation.isPending ? 'Salvando…' : 'Confirmar ponto de entrega'}
              </Button>
              <Button
                variant="text"
                disabled={manualLocation.isPending}
                onClick={() => {
                  setManualMode(false)
                  setSelectedPoint(null)
                  setManualAdjusted(false)
                }}
              >
                Cancelar seleção
              </Button>
            </Stack>
          </>
        )}
        {retry.isError && (
          <Alert severity="error">
            {getOrderErrorMessage(
              retry.error,
              'Não foi possível solicitar nova tentativa de localização.',
            )}
          </Alert>
        )}
        {manualLocation.isError && (
          <Alert severity="error">
            {getOrderErrorMessage(
              manualLocation.error,
              'Não foi possível salvar o ponto selecionado.',
            )}
          </Alert>
        )}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ display: manualMode ? 'none' : 'flex' }}
        >
          {canRetry && (
            <Button
              variant="outlined"
              startIcon={retry.isPending ? <CircularProgress size={16} /> : <RefreshCw size={16} />}
              disabled={retry.isPending}
              onClick={requestRetry}
            >
              {retry.isPending ? 'Solicitando…' : 'Tentar localizar novamente'}
            </Button>
          )}
          {order.geocodingStatus === 'NOT_FOUND' && (
            <Button
              variant="contained"
              startIcon={<MousePointer2 size={16} />}
              onClick={startManualSelection}
            >
              Selecionar ponto no mapa
            </Button>
          )}
          {order.geocodingStatus === 'PENDING' && (
            <Button
              variant="text"
              startIcon={isRefreshing ? <CircularProgress size={16} /> : <RefreshCw size={16} />}
              disabled={isRefreshing}
              onClick={onRefresh}
            >
              {isRefreshing ? 'Atualizando…' : 'Atualizar localização'}
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  )
}
