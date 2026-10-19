import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { getAccessToken, notifySessionExpired, setAccessToken } from '../../features/auth/session'
import type { LoginResponse } from '../../features/auth/types/auth'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 10_000,
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  const isRefreshRequest = /\/api\/auth\/refresh(?:$|\?)/.test(config.url ?? '')
  if (token && !isRefreshRequest) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshInProgress: Promise<string> | null = null

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? ''
      const isSessionRequest = /\/api\/auth\/(login|register|refresh|logout)(?:$|\?)/.test(url)
      const config = error.config as
        (InternalAxiosRequestConfig & { _sessionRetry?: boolean }) | undefined

      if (!isSessionRequest && config && !config._sessionRetry && getAccessToken()) {
        config._sessionRetry = true
        try {
          refreshInProgress ??= axios
            .post<LoginResponse>(`${apiClient.defaults.baseURL}/api/auth/refresh`, undefined, {
              withCredentials: true,
              timeout: apiClient.defaults.timeout ?? 10_000,
            })
            .then(({ data }) => {
              if (data.accessToken) setAccessToken(data.accessToken)
              return data.accessToken
            })
            .finally(() => {
              refreshInProgress = null
            })

          await refreshInProgress
          return apiClient(config)
        } catch (refreshError) {
          notifySessionExpired()
          return Promise.reject(refreshError)
        }
      }

      if (!isSessionRequest && getAccessToken()) notifySessionExpired()
    }
    return Promise.reject(error)
  },
)

export function getApiErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado.') {
  if (!axios.isAxiosError(error)) return fallback
  if (!error.response)
    return 'Não foi possível conectar à API. Verifique sua conexão e tente novamente.'

  switch (error.response.status) {
    case 400:
      return 'Confira os dados informados e tente novamente.'
    case 401:
      return 'E-mail ou senha inválidos.'
    case 409:
      return 'Este e-mail já possui cadastro.'
    case 429:
      return 'Muitas tentativas. Aguarde um pouco e tente novamente.'
    default:
      return error.response.status >= 500
        ? 'A API está temporariamente indisponível. Tente novamente em instantes.'
        : fallback
  }
}
