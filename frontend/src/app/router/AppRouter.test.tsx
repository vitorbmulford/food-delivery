import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../features/auth/context/AuthContext'
import { getAccessToken, setAccessToken } from '../../features/auth/session'
import { ColorModeProvider } from '../theme/ColorModeProvider'
import { AppRouter } from './AppRouter'

const { login, register, getCurrentUser, refreshSession, logoutSession, getDashboard, getOrder } =
  vi.hoisted(() => ({
    login: vi.fn(),
    register: vi.fn(),
    getCurrentUser: vi.fn(),
    refreshSession: vi.fn(),
    logoutSession: vi.fn(),
    getDashboard: vi.fn(),
    getOrder: vi.fn(),
  }))

vi.mock('../../features/auth/api/authApi', () => ({
  login,
  register,
  getCurrentUser,
  refreshSession,
  logoutSession,
}))

vi.mock('../../features/orders/api/ordersApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/orders/api/ordersApi')>()
  return { ...actual, getDashboard, getOrder }
})

const userProfile = { id: 'user-1', name: 'Ana Silva', email: 'ana@example.com' }

function NavigateToLogin() {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/login')}>Abrir login</button>
}

function renderRoute(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <ColorModeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider>
            <NavigateToLogin />
            <AppRouter />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ColorModeProvider>,
  )
  return { ...view, queryClient }
}

describe('autenticação e rotas', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((media: string) => ({
        matches: true,
        media,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
    setAccessToken(null)
    login.mockResolvedValue({ accessToken: 'test-token', tokenType: 'Bearer', expiresIn: 3600 })
    getCurrentUser.mockResolvedValue(userProfile)
    register.mockResolvedValue(userProfile)
    refreshSession.mockRejectedValue({ isAxiosError: true, response: { status: 401 } })
    logoutSession.mockResolvedValue(undefined)
    getOrder.mockRejectedValue({ isAxiosError: true, response: { status: 404 } })
    getDashboard.mockResolvedValue({
      from: '2026-10-13',
      to: '2026-10-19',
      totalCreated: 0,
      statusCounts: {
        RECEBIDO: 0,
        EM_PREPARO: 0,
        SAIU_PARA_ENTREGA: 0,
        ENTREGUE: 0,
        CANCELADO: 0,
      },
      deliveredInPeriod: 0,
      cancelledInPeriod: 0,
      dailyActivity: [],
      recentOrders: [],
      ongoingOrders: [],
    })
  })

  it('redireciona usuário anônimo de rota protegida para login e retorna à rota após autenticar', async () => {
    const user = userEvent.setup()
    renderRoute('/orders/7a5f6462-dd57-4fef-aed2-8825b85cef0b?view=history')

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com')
    await user.type(screen.getByLabelText('Senha'), 'Senha123!')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { name: 'Detalhes do pedido' })).toBeInTheDocument()
    expect(login).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'Senha123!' })
    expect(getCurrentUser).toHaveBeenCalledTimes(1)
  })

  it('restaura a sessão salva ao abrir a aplicação novamente', async () => {
    refreshSession.mockResolvedValue({
      accessToken: 'restored-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
    })
    renderRoute('/dashboard')

    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument()
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(getCurrentUser).toHaveBeenCalledTimes(1)
  })

  it('renderiza a página independente de Insights na rota protegida', async () => {
    setAccessToken('existing-token')
    renderRoute('/insights')

    expect(await screen.findByRole('heading', { name: 'Insights' })).toBeInTheDocument()
    expect(screen.getByText('Análise comercial e desempenho da operação.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Insights' })).toHaveAttribute('href', '/insights')
  })

  it('redireciona usuários autenticados para fora das rotas públicas', async () => {
    setAccessToken('existing-token')
    renderRoute('/register')

    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument()
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Abrir menu do usuário' }))
    expect(screen.getAllByText('Ana Silva')).toHaveLength(2)
    expect(screen.getAllByText('ana@example.com')).toHaveLength(2)
  })

  it('recolhe e expande a navegação lateral no desktop', async () => {
    const user = userEvent.setup()
    setAccessToken('existing-token')
    renderRoute('/dashboard')
    await screen.findByRole('heading', { name: 'Visão geral' })

    expect(screen.getByText('Workspace')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Recolher barra lateral' }))
    expect(
      await screen.findByRole('button', { name: 'Expandir barra lateral' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Abrir menu do usuário' }))
    expect(await screen.findByRole('menu')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Expandir barra lateral' }))
    expect(await screen.findByText('Workspace')).toBeInTheDocument()
  })

  it('encerra sessão quando /me rejeita um token inválido ou expirado', async () => {
    setAccessToken('expired-token')
    getCurrentUser.mockRejectedValue({ isAxiosError: true, response: { status: 401 } })
    renderRoute('/dashboard')

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(getAccessToken()).toBeNull()
  })

  it('mantém a página 404', async () => {
    renderRoute('/unknown')
    expect(
      await screen.findByRole('heading', { name: 'Página não encontrada' }),
    ).toBeInTheDocument()
  })

  it('faz logout e limpa sessão e cache privado', async () => {
    const user = userEvent.setup()
    const { queryClient } = renderRoute('/login')
    await screen.findByRole('heading', { name: 'Entrar' })
    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com')
    await user.type(screen.getByLabelText('Senha'), 'Senha123!')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByRole('heading', { name: 'Visão geral' })

    expect(queryClient.getQueryData(['auth', 'me'])).toEqual(userProfile)
    await user.click(screen.getByRole('button', { name: 'Abrir menu do usuário' }))
    expect(screen.getAllByText('ana@example.com')).toHaveLength(2)
    await user.click(screen.getByRole('menuitem', { name: 'Sair' }))
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    await waitFor(() => expect(queryClient.getQueryData(['auth', 'me'])).toBeUndefined())
    expect(screen.queryByText('Ana Silva')).not.toBeInTheDocument()
  })

  it('mostra erro para credenciais inválidas sem iniciar um ciclo de redirecionamento', async () => {
    const user = userEvent.setup()
    login.mockRejectedValue({ isAxiosError: true, response: { status: 401 } })
    renderRoute('/login')
    await screen.findByRole('heading', { name: 'Entrar' })
    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com')
    await user.type(screen.getByLabelText('Senha'), 'errada')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })
})
