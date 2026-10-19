import type { LoginResponse, RegisterRequest, User } from '../auth/types/auth'
import type { Insights } from '../insights/insightsApi'
import type { DashboardData } from '../orders/types/dashboard'
import type {
  CreateOrderInput,
  Order,
  OrderPage,
  OrderStatus,
  OrderStatusHistory,
} from '../orders/types/order'

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

const demoUser: User = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Mariana Costa',
  email: 'demo@foody.com.br',
}
const names = [
  'Mariana Costa',
  'Rafael Oliveira',
  'Camila Santos',
  'Lucas Almeida',
  'Beatriz Lima',
  'Pedro Souza',
  'Julia Ferreira',
  'Gabriel Ribeiro',
  'Larissa Gomes',
  'Felipe Carvalho',
]
const products = [
  { name: 'Burger Clássico', price: 32.9 },
  { name: 'Burger Cheddar Bacon', price: 39.9 },
  { name: 'Batata Frita Grande', price: 18.5 },
  { name: 'Combo Foody Duplo', price: 59.9 },
  { name: 'Refrigerante Lata', price: 7.5 },
  { name: 'Brownie de Chocolate', price: 14.9 },
  { name: 'Salada Caesar', price: 29.9 },
  { name: 'Milk-shake de Morango', price: 19.9 },
  { name: 'Onion Rings', price: 17.9 },
]
const neighborhoods = [
  'Pinheiros',
  'Vila Madalena',
  'Jardins',
  'Moema',
  'Itaim Bibi',
  'Perdizes',
  'Consolação',
]
const statusByIndex: OrderStatus[] = [
  'ENTREGUE',
  'ENTREGUE',
  'EM_PREPARO',
  'ENTREGUE',
  'SAIU_PARA_ENTREGA',
  'ENTREGUE',
  'RECEBIDO',
  'CANCELADO',
  'ENTREGUE',
  'SAIU_PARA_ENTREGA',
  'ENTREGUE',
  'EM_PREPARO',
]
function hashDemoIdPart(value: number) {
  let hash = value | 0
  hash = Math.imul(hash ^ (hash >>> 16), 0x21f0aaad)
  hash = Math.imul(hash ^ (hash >>> 15), 0x735a2d97)
  hash ^= hash >>> 15
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const demoOrderId = (sequence: number) =>
  `${hashDemoIdPart(sequence)}-${hashDemoIdPart(sequence + 0x10000).slice(0, 4)}-4${hashDemoIdPart(sequence + 0x20000).slice(0, 3)}-8${hashDemoIdPart(sequence + 0x30000).slice(0, 3)}-${hashDemoIdPart(sequence + 0x40000)}${sequence.toString(16).padStart(4, '0')}`

const historyById = new Map<string, OrderStatusHistory[]>()
const orders: Order[] = Array.from({ length: 96 }, (_, index) => {
  const id = demoOrderId(index + 1)
  const daysAgo = (index * 7 + Math.floor(index / 4) * 3) % 91
  const created = new Date()
  created.setDate(created.getDate() - daysAgo)
  created.setHours(8 + ((index * 5) % 13), (index * 17) % 60, 0, 0)
  const status = statusByIndex[index % statusByIndex.length]!
  const customerName = names[index % names.length]!
  const itemCount = 1 + (index % 3)
  const items = Array.from({ length: itemCount }, (_, itemIndex) => {
    const product = products[(index * 2 + itemIndex * 3) % products.length]!
    const quantity = 1 + ((index + itemIndex) % 2)
    return {
      id: `${id.slice(-6)}-${itemIndex + 1}`,
      productName: product.name,
      quantity,
      unitPrice: product.price,
      subtotal: Number((product.price * quantity).toFixed(2)),
    }
  })
  const stages: Array<{ status: OrderStatus; minutes: number }> = [
    { status: 'RECEBIDO', minutes: 0 },
  ]
  if (status === 'EM_PREPARO' || status === 'SAIU_PARA_ENTREGA' || status === 'ENTREGUE')
    stages.push({ status: 'EM_PREPARO', minutes: 8 + (index % 9) })
  if (status === 'SAIU_PARA_ENTREGA' || status === 'ENTREGUE')
    stages.push({ status: 'SAIU_PARA_ENTREGA', minutes: 24 + (index % 13) })
  if (status === 'ENTREGUE') stages.push({ status: 'ENTREGUE', minutes: 45 + (index % 28) })
  if (status === 'CANCELADO') stages.push({ status: 'CANCELADO', minutes: 6 + (index % 12) })
  const history = stages.map((stage, stageIndex) => ({
    id: `${id.slice(-6)}-${stageIndex + 1}`,
    previousStatus: stageIndex ? stages[stageIndex - 1]!.status : null,
    newStatus: stage.status,
    changedAt: new Date(created.getTime() + stage.minutes * 60_000).toISOString(),
    changedBy: 'Mariana Costa',
  }))
  historyById.set(id, history)
  const updatedAt = history[history.length - 1]!.changedAt
  return {
    id,
    customer: {
      id: `20000000-0000-4000-8000-${String((index % 24) + 1).padStart(12, '0')}`,
      name: customerName,
      email: `${customerName.toLocaleLowerCase('pt-BR').replaceAll(' ', '.')}@email.com.br`,
    },
    status,
    items,
    deliveryAddress: {
      street: ['Rua dos Pinheiros', 'Avenida Paulista', 'Rua Harmonia', 'Alameda Santos'][
        index % 4
      ]!,
      number: String(100 + index * 3),
      complement: index % 3 === 0 ? `Apto ${index + 10}` : null,
      neighborhood: neighborhoods[index % neighborhoods.length]!,
      city: 'São Paulo',
      state: 'SP',
      postalCode: `054${String(index % 10)}0-0${String(index % 10)}0`,
    },
    totalAmount: Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)),
    createdAt: created.toISOString(),
    updatedAt,
    coordinates: {
      latitude: -23.55 + (index % 14) * 0.006,
      longitude: -46.64 + (index % 11) * 0.007,
    },
    geocodingStatus: 'SUCCESS',
    coordinateSource: 'AUTOMATIC',
    suggestedCoordinates: null,
    geocodingSuggestionLevel: null,
  }
})
let nextDemoOrderSequence = orders.length

const asDate = (value: string) => new Date(`${value}T00:00:00-03:00`)
const dateKey = (value: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(value))
const between = (value: string, from: string, to: string) => {
  const date = dateKey(value)
  return date >= from && date <= to
}
const total = (order: Order) => order.totalAmount
const ordersByDate = (from: string, to: string) =>
  orders.filter((order) => between(order.createdAt, from, to))
const eventIn = (order: Order, status: OrderStatus, from: string, to: string) =>
  historyById
    .get(order.id)
    ?.find((event) => event.newStatus === status && between(event.changedAt, from, to))

export function demoLogin(): LoginResponse {
  return { accessToken: 'foody-demo-access-token', tokenType: 'Bearer', expiresIn: 3600 }
}
export function demoCurrentUser(): User {
  return demoUser
}
export function demoRegister(request: RegisterRequest): User {
  return { ...demoUser, name: request.name, email: request.email }
}

export function demoDashboard(from: string, to: string): DashboardData {
  const cohort = ordersByDate(from, to)
  const statusCounts: DashboardData['statusCounts'] = {
    RECEBIDO: 0,
    EM_PREPARO: 0,
    SAIU_PARA_ENTREGA: 0,
    ENTREGUE: 0,
    CANCELADO: 0,
  }
  cohort.forEach((order) => {
    statusCounts[order.status] += 1
  })
  const dayValues: DashboardData['dailyActivity'] = []
  for (let date = asDate(from); date <= asDate(to); date.setDate(date.getDate() + 1)) {
    const key = date.toLocaleDateString('en-CA')
    dayValues.push({
      date: key,
      created: cohort.filter((order) => dateKey(order.createdAt) === key).length,
      delivered: orders.filter((order) => !!eventIn(order, 'ENTREGUE', key, key)).length,
      cancelled: orders.filter((order) => !!eventIn(order, 'CANCELADO', key, key)).length,
    })
  }
  const recent = [...cohort].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const asDashboardOrder = (order: Order) => ({
    id: order.id,
    createdAt: order.createdAt,
    status: order.status,
  })
  return {
    from,
    to,
    totalCreated: cohort.length,
    statusCounts,
    deliveredInPeriod: orders.filter((order) => !!eventIn(order, 'ENTREGUE', from, to)).length,
    cancelledInPeriod: orders.filter((order) => !!eventIn(order, 'CANCELADO', from, to)).length,
    dailyActivity: dayValues,
    recentOrders: recent.slice(0, 8).map(asDashboardOrder),
    ongoingOrders: orders
      .filter((order) => ['RECEBIDO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA'].includes(order.status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8)
      .map(asDashboardOrder),
  }
}

export function demoListOrders(page: number, size: number, status?: OrderStatus): OrderPage {
  const filtered = [...orders]
    .filter((order) => !status || order.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const content = filtered.slice(page * size, (page + 1) * size)
  return {
    content,
    page: {
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / size),
      number: page,
      size,
    },
  }
}
export function demoGetOrder(id: string): Order {
  const found = orders.find((order) => order.id === id)
  if (!found) throw new Error('Pedido não encontrado')
  return found
}
export function demoGetHistory(id: string): OrderStatusHistory[] {
  return historyById.get(id) ?? []
}
export function demoCreateOrder(input: CreateOrderInput): Order {
  const now = new Date().toISOString()
  const id = demoOrderId(++nextDemoOrderSequence)
  const items = input.items.map((item, index) => ({
    ...item,
    id: `${id.slice(-6)}-${index + 1}`,
    subtotal: Number((item.quantity * item.unitPrice).toFixed(2)),
  }))
  const order: Order = {
    id,
    customer: demoUser,
    status: 'RECEBIDO',
    items,
    deliveryAddress: {
      ...input.deliveryAddress,
      complement: input.deliveryAddress.complement || null,
    },
    totalAmount: Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)),
    createdAt: now,
    updatedAt: now,
    coordinates: null,
    geocodingStatus: 'PENDING',
    coordinateSource: null,
    suggestedCoordinates: null,
    geocodingSuggestionLevel: null,
  }
  orders.unshift(order)
  historyById.set(id, [
    {
      id: `${id.slice(-6)}-1`,
      previousStatus: null,
      newStatus: 'RECEBIDO',
      changedAt: now,
      changedBy: demoUser.name,
    },
  ])
  return order
}
export function demoUpdateOrderStatus(id: string, status: OrderStatus): Order {
  const order = demoGetOrder(id)
  const previousStatus = order.status
  order.status = status
  order.updatedAt = new Date().toISOString()
  const history = historyById.get(id) ?? []
  history.push({
    id: `${id.slice(-6)}-${history.length + 1}`,
    previousStatus,
    newStatus: status,
    changedAt: order.updatedAt,
    changedBy: demoUser.name,
  })
  historyById.set(id, history)
  return order
}
export function demoInsights(from: string, to: string): Insights {
  const cohort = ordersByDate(from, to)
  const delivered = orders.filter((order) => !!eventIn(order, 'ENTREGUE', from, to))
  const cancelled = orders.filter((order) => !!eventIn(order, 'CANCELADO', from, to))
  const currentStatusValues = (
    ['RECEBIDO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA', 'ENTREGUE', 'CANCELADO'] as OrderStatus[]
  ).map((status) => {
    const list = orders.filter((order) => order.status === status)
    return { status, count: list.length, value: list.reduce((sum, order) => sum + total(order), 0) }
  })
  const daysCount = Math.round((asDate(to).getTime() - asDate(from).getTime()) / 86_400_000) + 1
  const previousTo = new Date(asDate(from).getTime() - 86_400_000).toLocaleDateString('en-CA')
  const previousFrom = new Date(asDate(from).getTime() - daysCount * 86_400_000).toLocaleDateString(
    'en-CA',
  )
  const previousOrders = ordersByDate(previousFrom, previousTo)
  const previousDelivered = orders.filter(
    (order) => !!eventIn(order, 'ENTREGUE', previousFrom, previousTo),
  )
  const previousCancelled = orders.filter(
    (order) => !!eventIn(order, 'CANCELADO', previousFrom, previousTo),
  )
  const buildSummary = (created: Order[], done: Order[], canceled: Order[]) => ({
    createdValue: created.reduce((sum, order) => sum + total(order), 0),
    createdCount: created.length,
    deliveredValue: done.reduce((sum, order) => sum + total(order), 0),
    deliveredCount: done.length,
    cancelledValue: canceled.reduce((sum, order) => sum + total(order), 0),
    cancelledCount: canceled.length,
    ongoingValue: orders
      .filter((order) => ['RECEBIDO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA'].includes(order.status))
      .reduce((sum, order) => sum + total(order), 0),
    averageDeliveredTicket: done.length
      ? done.reduce((sum, order) => sum + total(order), 0) / done.length
      : 0,
    itemsSold: done.reduce(
      (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    ),
  })
  const daily = []
  for (let date = asDate(from); date <= asDate(to); date.setDate(date.getDate() + 1)) {
    const key = date.toLocaleDateString('en-CA')
    const created = cohort.filter((order) => dateKey(order.createdAt) === key)
    const done = delivered.filter((order) => !!eventIn(order, 'ENTREGUE', key, key))
    const canceled = cancelled.filter((order) => !!eventIn(order, 'CANCELADO', key, key))
    daily.push({
      date: key,
      createdValue: created.reduce((sum, order) => sum + total(order), 0),
      deliveredValue: done.reduce((sum, order) => sum + total(order), 0),
      cancelledValue: canceled.reduce((sum, order) => sum + total(order), 0),
      createdCount: created.length,
      deliveredCount: done.length,
      cancelledCount: canceled.length,
    })
  }
  const productTotals = new Map<string, { name: string; quantity: number; value: number }>()
  delivered.forEach((order) =>
    order.items.forEach((item) => {
      const key = item.productName.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
      const current = productTotals.get(key) ?? {
        name: item.productName.trim().replace(/\s+/g, ' '),
        quantity: 0,
        value: 0,
      }
      current.quantity += item.quantity
      current.value += item.subtotal
      productTotals.set(key, current)
    }),
  )
  const sold = [...productTotals.values()].sort((a, b) => b.quantity - a.quantity)
  const countHour = new Array<number>(24).fill(0)
  cohort.forEach((order) => {
    const hour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(order.createdAt)),
    )
    countHour[hour] = countHour[hour]! + 1
  })
  const duration = (statusA: OrderStatus, statusB: OrderStatus) => {
    const values = delivered.flatMap((order) => {
      const a = historyById.get(order.id)?.find((event) => event.newStatus === statusA)
      const b = historyById.get(order.id)?.find((event) => event.newStatus === statusB)
      if (!a || !b) return []
      const minutes = (Date.parse(b.changedAt) - Date.parse(a.changedAt)) / 60_000
      return minutes >= 0 ? [minutes] : []
    })
    return {
      minutes: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
      count: values.length,
    }
  }
  const receivedPrep = duration('RECEBIDO', 'EM_PREPARO')
  const prepDelivery = duration('EM_PREPARO', 'SAIU_PARA_ENTREGA')
  const delivery = duration('SAIU_PARA_ENTREGA', 'ENTREGUE')
  const full = duration('RECEBIDO', 'ENTREGUE')
  return {
    from,
    to,
    current: buildSummary(cohort, delivered, cancelled),
    previous: buildSummary(previousOrders, previousDelivered, previousCancelled),
    daily,
    currentStatusValues,
    hourly: countHour.map((count, hour) => ({ hour, count })),
    products: sold.slice(0, 10).map((item) => ({
      ...item,
      sharePercent: sold.length
        ? (item.quantity / sold.reduce((sum, product) => sum + product.quantity, 0)) * 100
        : 0,
    })),
    performance: {
      receivedToPreparationMinutes: receivedPrep.minutes,
      receivedToPreparationCount: receivedPrep.count,
      preparationMinutes: prepDelivery.minutes,
      preparationCount: prepDelivery.count,
      deliveryMinutes: delivery.minutes,
      deliveryCount: delivery.count,
      totalMinutes: full.minutes,
      totalCount: full.count,
    },
  }
}
