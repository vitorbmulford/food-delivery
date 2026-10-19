import { apiClient } from '../../../lib/api/client'
import type { LoginRequest, LoginResponse, RegisterRequest, User } from '../types/auth'

export async function login(request: LoginRequest) {
  const { data } = await apiClient.post<LoginResponse>('/api/auth/login', request)
  return data
}

export async function refreshSession() {
  const { data } = await apiClient.post<LoginResponse>('/api/auth/refresh')
  return data
}

export async function logoutSession() {
  await apiClient.post('/api/auth/logout')
}

export async function register(request: RegisterRequest) {
  const { data } = await apiClient.post<User>('/api/auth/register', request)
  return data
}

export async function getCurrentUser() {
  const { data } = await apiClient.get<User>('/api/users/me')
  return data
}
