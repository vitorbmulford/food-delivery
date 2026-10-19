import type { OrderStatus } from './order'

export type DashboardOrder = { id: string; createdAt: string; status: OrderStatus }
export type DashboardDailyActivity = {
  date: string
  created: number
  delivered: number
  cancelled: number
}
export type DashboardData = {
  from: string
  to: string
  totalCreated: number
  statusCounts: Record<OrderStatus, number>
  deliveredInPeriod: number
  cancelledInPeriod: number
  dailyActivity: DashboardDailyActivity[]
  recentOrders: DashboardOrder[]
  ongoingOrders: DashboardOrder[]
}
