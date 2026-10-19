import type { OrderStatusHistory } from '../types/order'

export function sortOrderHistory(events: OrderStatusHistory[]) {
  return [...events].sort((a, b) => {
    const time = Date.parse(a.changedAt) - Date.parse(b.changedAt)
    return time || a.id.localeCompare(b.id)
  })
}
