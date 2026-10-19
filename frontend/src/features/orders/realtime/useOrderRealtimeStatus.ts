import { createContext, useContext } from 'react'
import type { RealtimeStatus } from './realtimeTypes'

export const orderRealtimeStatusContext = createContext<RealtimeStatus>('disconnected')

export function useOrderRealtimeStatus() {
  return useContext(orderRealtimeStatusContext)
}
