import axios from 'axios'
import type { ApiErrorPayload } from '../../types/api'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  timeout: 10_000,
  headers: { Accept: 'application/json' },
})

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    return error.response?.data?.message ?? error.message ?? 'Não foi possível comunicar com a API.'
  }

  return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'
}
