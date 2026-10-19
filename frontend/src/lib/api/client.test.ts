import type { AxiosAdapter } from 'axios'
import axios from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import { setAccessToken } from '../../features/auth/session'

describe('apiClient autenticação', () => {
  afterEach(() => {
    setAccessToken(null)
    vi.restoreAllMocks()
  })

  it('inclui o Bearer token nas chamadas autenticadas', async () => {
    setAccessToken('jwt-example')
    let authorization: unknown
    const adapter: AxiosAdapter = async (config) => {
      authorization = config.headers.Authorization
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
    }
    await apiClient.get('/api/users/me', { adapter })
    expect(authorization).toBe('Bearer jwt-example')
  })

  it('notifica a aplicação quando uma chamada privada recebe 401', async () => {
    setAccessToken('expired-jwt')
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('Session expired'))
    const dispatch = vi.spyOn(window, 'dispatchEvent')
    const adapter: AxiosAdapter = async (config) => {
      const error = Object.assign(new Error('Unauthorized'), {
        isAxiosError: true,
        config,
        response: { data: {}, status: 401, statusText: 'Unauthorized', headers: {}, config },
      })
      throw error
    }
    await expect(apiClient.get('/api/users/me', { adapter })).rejects.toBeTruthy()
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'foody:session-expired' }),
    )
  })
})
