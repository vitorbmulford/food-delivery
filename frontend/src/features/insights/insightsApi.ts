import { apiClient } from '../../lib/api/client'
import { DEMO_MODE, demoInsights } from '../demo/demoData'

export type Insights = {
  from: string
  to: string
  current: Summary
  previous: Summary
  daily: Day[]
  currentStatusValues: { status: string; value: number; count: number }[]
  hourly: { hour: number; count: number }[]
  products: { name: string; quantity: number; value: number; sharePercent: number }[]
  performance: {
    receivedToPreparationMinutes: number
    receivedToPreparationCount: number
    preparationMinutes: number
    preparationCount: number
    deliveryMinutes: number
    deliveryCount: number
    totalMinutes: number
    totalCount: number
  }
}
type Summary = {
  createdValue: number
  createdCount: number
  deliveredValue: number
  deliveredCount: number
  cancelledValue: number
  cancelledCount: number
  ongoingValue: number
  averageDeliveredTicket: number
  itemsSold: number
}
type Day = {
  date: string
  createdValue: number
  deliveredValue: number
  cancelledValue: number
  createdCount: number
  deliveredCount: number
  cancelledCount: number
}

export async function getInsights(from: string, to: string, signal?: AbortSignal) {
  if (DEMO_MODE) return demoInsights(from, to)
  const { data } = await apiClient.get<Insights>('/api/insights', {
    params: { from, to },
    ...(signal ? { signal } : {}),
  })
  return data
}
