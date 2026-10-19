import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './context/AuthContext'
import { loginSchema, registerSchema } from './schemas/authSchemas'
import { LoginPage } from '../../pages/LoginPage'
import { RegisterPage } from '../../pages/RegisterPage'
import { appTheme } from '../../app/theme/theme'

const { login, register, getCurrentUser, refreshSession, logoutSession } = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentUser: vi.fn(),
  refreshSession: vi.fn(),
  logoutSession: vi.fn(),
}))

vi.mock('./api/authApi', () => ({
  login,
  register,
  getCurrentUser,
  refreshSession,
  logoutSession,
}))

function renderPage(path: '/login' | '/register') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

describe('formulários de autenticação', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    vi.clearAllMocks()
    login.mockResolvedValue({ accessToken: 'test-token', tokenType: 'Bearer', expiresIn: 3600 })
    register.mockResolvedValue({ id: 'user-1', name: 'Ana Silva', email: 'ana@example.com' })
    getCurrentUser.mockResolvedValue({ id: 'user-1', name: 'Ana Silva', email: 'ana@example.com' })
    refreshSession.mockRejectedValue({ isAxiosError: true, response: { status: 401 } })
    logoutSession.mockResolvedValue(undefined)
  })

  it('valida campos obrigatórios e formato de e-mail do login', async () => {
    const user = userEvent.setup()
    renderPage('/login')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Informe seu e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('E-mail'), 'invalido')
    await user.type(screen.getByLabelText('Senha'), 'senha')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
  })

  it('valida comprimento e composição da senha no cadastro', () => {
    expect(
      registerSchema.safeParse({
        name: 'Ana',
        email: 'ana@example.com',
        password: 'abc',
        confirmPassword: 'abc',
      }).success,
    ).toBe(false)
    expect(
      registerSchema.safeParse({
        name: 'Ana',
        email: 'ana@example.com',
        password: 'senha123!',
        confirmPassword: 'senha123!',
      }).success,
    ).toBe(false)
    expect(
      loginSchema.safeParse({ email: 'ana@example.com', password: 'x'.repeat(73) }).success,
    ).toBe(false)
    expect(
      registerSchema.safeParse({
        name: 'Ana',
        email: 'ana@example.com',
        password: 'Senha123!',
        confirmPassword: 'Senha123!',
      }).success,
    ).toBe(true)
  })

  it('envia cadastro válido sem confirmação de senha e apresenta sucesso', async () => {
    const user = userEvent.setup()
    renderPage('/register')
    await user.type(screen.getByLabelText('Nome'), 'Ana Silva')
    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com')
    await user.type(screen.getByLabelText('Senha'), 'Senha123!')
    await user.type(screen.getByLabelText('Confirmar senha'), 'Senha123!')
    await user.click(screen.getByRole('button', { name: 'Criar acesso' }))

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Cadastro realizado.')
    expect(register).toHaveBeenCalledWith({
      name: 'Ana Silva',
      email: 'ana@example.com',
      password: 'Senha123!',
    })
  })

  it('trata e-mail duplicado no cadastro', async () => {
    const user = userEvent.setup()
    register.mockRejectedValue({ isAxiosError: true, response: { status: 409 } })
    renderPage('/register')
    await user.type(screen.getByLabelText('Nome'), 'Ana Silva')
    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com')
    await user.type(screen.getByLabelText('Senha'), 'Senha123!')
    await user.type(screen.getByLabelText('Confirmar senha'), 'Senha123!')
    await user.click(screen.getByRole('button', { name: 'Criar acesso' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Este e-mail já possui cadastro.')
  })

  it('mostra em vermelho que as senhas divergem ao sair da confirmação', async () => {
    const user = userEvent.setup()
    renderPage('/register')
    await user.type(screen.getByLabelText('Senha'), 'Senha123!')
    const confirmation = screen.getByLabelText('Confirmar senha')
    await user.type(confirmation, 'Senha123?')
    await user.tab()

    expect(await screen.findByText('As senhas não coincidem.')).toBeInTheDocument()
    expect(confirmation).toHaveAttribute('aria-invalid', 'true')

    await user.clear(confirmation)
    await user.type(confirmation, 'Senha123!')
    await waitFor(() =>
      expect(screen.queryByText('As senhas não coincidem.')).not.toBeInTheDocument(),
    )
  })
})
