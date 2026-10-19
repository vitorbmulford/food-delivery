import { Client, type IMessage } from '@stomp/stompjs'
import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/context/useAuth'
import { refreshSession } from '../../auth/api/authApi'
import { getAccessToken, notifySessionExpired, setAccessToken } from '../../auth/session'
import { apiClient } from '../../../lib/api/client'
import { orderKeys } from '../hooks/useOrders'
import { insightsKeys } from '../../insights/useInsights'
import { orderStatuses, type OrderStatus } from '../types/order'
import { orderRealtimeStatusContext } from './useOrderRealtimeStatus'
import type { RealtimeStatus } from './realtimeTypes'
import { DEMO_MODE } from '../../demo/demoData'

type OrderStatusChangedEvent = {
  eventType: 'ORDER_STATUS_CHANGED'
  orderId: string
  previousStatus: OrderStatus
  newStatus: OrderStatus
  historyId: string
  changedAt: string
}

const ORDER_DESTINATION = '/user/queue/orders'
const MAX_RETRY_DELAY = 30_000
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function parseEvent(body: string): OrderStatusChangedEvent | null {
  try {
    const value: unknown = JSON.parse(body)
    if (!value || typeof value !== 'object') return null
    const event = value as Record<string, unknown>
    if (
      event.eventType !== 'ORDER_STATUS_CHANGED' ||
      typeof event.orderId !== 'string' ||
      !UUID_PATTERN.test(event.orderId) ||
      typeof event.previousStatus !== 'string' ||
      !orderStatuses.includes(event.previousStatus as OrderStatus) ||
      typeof event.newStatus !== 'string' ||
      !orderStatuses.includes(event.newStatus as OrderStatus) ||
      typeof event.historyId !== 'string' ||
      !UUID_PATTERN.test(event.historyId) ||
      typeof event.changedAt !== 'string' ||
      !Number.isFinite(Date.parse(event.changedAt))
    ) {
      return null
    }
    return event as OrderStatusChangedEvent
  } catch {
    return null
  }
}

function websocketUrl() {
  const url = new URL('/ws', apiClient.defaults.baseURL || window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

export function OrderRealtimeProvider({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<RealtimeStatus>('disconnected')
  const generationRef = useRef(0)

  const handleMessage = useCallback(
    (message: IMessage) => {
      const event = parseEvent(message.body)
      if (!event) return
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: orderKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: orderKeys.dashboards() }),
        queryClient.invalidateQueries({ queryKey: orderKeys.detail(event.orderId), exact: true }),
        queryClient.invalidateQueries({ queryKey: orderKeys.history(event.orderId), exact: true }),
        queryClient.invalidateQueries({ queryKey: insightsKeys.all }),
      ])
    },
    [queryClient],
  )

  useEffect(() => {
    const generation = ++generationRef.current
    if (!isAuthenticated || DEMO_MODE) return

    let stopped = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let retryAttempt = 0
    let client: Client | undefined

    const clearRetry = () => {
      if (retryTimer) clearTimeout(retryTimer)
      retryTimer = undefined
    }

    const isCurrent = () => !stopped && generationRef.current === generation

    const refreshToken = async () => {
      try {
        const response = await refreshSession()
        if (!response.accessToken) throw new Error('Session refresh returned no access token')
        setAccessToken(response.accessToken)
        return response.accessToken
      } catch {
        if (isCurrent()) notifySessionExpired()
        return null
      }
    }

    const scheduleRetry = (refreshBeforeConnect: boolean) => {
      if (!isCurrent()) return
      client = undefined
      setStatus(
        typeof navigator !== 'undefined' && !navigator.onLine ? 'disconnected' : 'reconnecting',
      )
      clearRetry()
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      const delay = Math.min(1_000 * 2 ** retryAttempt, MAX_RETRY_DELAY)
      retryAttempt += 1
      retryTimer = setTimeout(() => void connect(refreshBeforeConnect), delay)
    }

    const connect = async (refreshBeforeConnect: boolean) => {
      if (!isCurrent() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        if (isCurrent()) setStatus('disconnected')
        return
      }
      clearRetry()
      setStatus(retryAttempt ? 'reconnecting' : 'disconnected')

      let token: string | null = getAccessToken()
      if (refreshBeforeConnect) token = await refreshToken()
      if (!token || !isCurrent()) return

      const nextClient = new Client({
        brokerURL: websocketUrl(),
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 0,
        heartbeatIncoming: 10_000,
        heartbeatOutgoing: 10_000,
        debug: () => undefined,
        onConnect: () => {
          if (!isCurrent() || client !== nextClient) return
          retryAttempt = 0
          setStatus('connected')
          nextClient.subscribe(ORDER_DESTINATION, handleMessage)
        },
        onWebSocketClose: () => {
          if (isCurrent() && client === nextClient) scheduleRetry(true)
        },
        onStompError: () => {
          if (isCurrent() && client === nextClient) {
            void nextClient.deactivate({ force: true }).finally(() => scheduleRetry(true))
          }
        },
        onWebSocketError: () => {
          if (isCurrent() && client === nextClient) {
            void nextClient.deactivate({ force: true }).finally(() => scheduleRetry(true))
          }
        },
      })
      client = nextClient
      nextClient.activate()
    }

    const onOnline = () => {
      if (!isCurrent() || client?.active || retryTimer) return
      retryAttempt = Math.max(1, retryAttempt)
      void connect(true)
    }
    const onOffline = () => {
      if (!isCurrent()) return
      clearRetry()
      if (client) {
        const oldClient = client
        client = undefined
        void oldClient.deactivate({ force: true })
      }
      setStatus('disconnected')
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    void connect(false)

    return () => {
      stopped = true
      clearRetry()
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      if (client) {
        const oldClient = client
        client = undefined
        void oldClient.deactivate({ force: true })
      }
    }
  }, [handleMessage, isAuthenticated])

  const visibleStatus = isAuthenticated && !DEMO_MODE ? status : 'disconnected'
  return (
    <orderRealtimeStatusContext.Provider value={visibleStatus}>
      {children}
    </orderRealtimeStatusContext.Provider>
  )
}
