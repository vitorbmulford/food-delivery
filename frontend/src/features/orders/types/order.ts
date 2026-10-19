export const orderStatuses = [
  'RECEBIDO',
  'EM_PREPARO',
  'SAIU_PARA_ENTREGA',
  'ENTREGUE',
  'CANCELADO',
] as const

export type OrderStatus = (typeof orderStatuses)[number]

export type CreateOrderItem = { productName: string; quantity: number; unitPrice: number }
export type DeliveryAddressInput = {
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  postalCode: string
}
export type DeliveryAddress = Omit<DeliveryAddressInput, 'complement'> & {
  complement: string | null
}
export type CreateOrderInput = { items: CreateOrderItem[]; deliveryAddress: DeliveryAddressInput }

export type Order = {
  id: string
  customer: { id: string; name: string; email: string }
  status: OrderStatus
  items: Array<{
    id: string
    productName: string
    quantity: number
    unitPrice: number
    subtotal: number
  }>
  deliveryAddress: DeliveryAddress
  totalAmount: number
  createdAt: string
  updatedAt: string
  coordinates: { latitude: number; longitude: number } | null
  geocodingStatus: GeocodingStatus
  coordinateSource: CoordinateSource | null
  suggestedCoordinates: { latitude: number; longitude: number } | null
  geocodingSuggestionLevel: GeocodingSuggestionLevel | null
}

export type GeocodingStatus = 'PENDING' | 'SUCCESS' | 'NOT_FOUND' | 'FAILED' | (string & {})
export type CoordinateSource = 'AUTOMATIC' | 'MANUAL'
export type GeocodingSuggestionLevel = 'STREET' | 'NEIGHBORHOOD' | 'POSTAL_CODE'

export type OrderStatusHistory = {
  id: string
  previousStatus: OrderStatus | null
  newStatus: OrderStatus
  changedAt: string
  changedBy: string | null
}

export type OrderPage = {
  content: Order[]
  page: {
    totalElements: number
    totalPages: number
    number: number
    size: number
  }
}

export type OrderFilters = { page: number; size: number; status?: OrderStatus }

export const orderStatusLabels: Record<OrderStatus, string> = {
  RECEBIDO: 'Recebido',
  EM_PREPARO: 'Em preparo',
  SAIU_PARA_ENTREGA: 'Saiu para entrega',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
}

export const allowedNextStatuses: Record<OrderStatus, OrderStatus[]> = {
  RECEBIDO: ['EM_PREPARO', 'CANCELADO'],
  EM_PREPARO: ['SAIU_PARA_ENTREGA', 'CANCELADO'],
  SAIU_PARA_ENTREGA: ['ENTREGUE'],
  ENTREGUE: [],
  CANCELADO: [],
}
