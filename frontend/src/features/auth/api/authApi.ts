import { apiClient } from '../../../lib/api/client'
import type { LoginRequest, LoginResponse, RegisterRequest, User } from '../types/auth'
import { DEMO_MODE, demoCurrentUser, demoLogin, demoRegister } from '../../demo/demoData'

export async function login(request: LoginRequest) {
  if (DEMO_MODE) return demoLogin()
  const { data } = await apiClient.post<LoginResponse>('/api/auth/login', request)
  return data
}

export async function refreshSession() {
  if (DEMO_MODE) return demoLogin()
  const { data } = await apiClient.post<LoginResponse>('/api/auth/refresh')
  return data
}

export async function logoutSession() {
  if (DEMO_MODE) return
  await apiClient.post('/api/auth/logout')
}

export async function register(request: RegisterRequest) {
  if (DEMO_MODE) return demoRegister(request)
  const { data } = await apiClient.post<User>('/api/auth/register', request)
  return data
}

export async function getCurrentUser() {
  if (DEMO_MODE) return demoCurrentUser()
  const { data } = await apiClient.get<User>('/api/users/me')
  return data
}
