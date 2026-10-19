import axios from 'axios'
import type { OrderStatus } from '../types/order'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function formatCurrency(value: number) {
  return currency.format(value)
}

export function formatOrderDate(value: string) {
  return dateTime.format(new Date(value))
}

export function statusColor(
  status: OrderStatus,
): 'default' | 'info' | 'warning' | 'success' | 'error' {
  switch (status) {
    case 'RECEBIDO':
      return 'info'
    case 'EM_PREPARO':
      return 'warning'
    case 'SAIU_PARA_ENTREGA':
    case 'ENTREGUE':
      return 'success'
    case 'CANCELADO':
      return 'error'
  }
}

export function getOrderErrorMessage(
  error: unknown,
  fallback = 'Não foi possível concluir esta operação.',
) {
  if (!axios.isAxiosError(error)) return fallback
  if (!error.response)
    return 'Não foi possível conectar à API. Verifique sua conexão e tente novamente.'
  switch (error.response.status) {
    case 400:
      return 'Confira os dados informados e tente novamente.'
    case 401:
      return 'Sua sessão precisa ser validada novamente.'
    case 403:
      return 'Você não tem permissão para esta operação.'
    case 404:
      return 'Este pedido não foi encontrado.'
    case 409:
      return 'O pedido foi alterado em outra operação. Os dados atuais foram recarregados.'
    case 429:
      return 'Muitas solicitações. Aguarde um pouco e tente novamente.'
    default:
      return error.response.status >= 500
        ? 'A API está temporariamente indisponível. Tente novamente em instantes.'
        : fallback
  }
}
