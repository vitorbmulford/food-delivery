import { render, screen } from '@testing-library/react'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { appTheme } from '../theme/theme'
import { AppRouter } from './AppRouter'

function renderRoute(path: string) {
  const queryClient = new QueryClient()

  return render(
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <AppRouter />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

describe('AppRouter', () => {
  it('renders the initial dashboard', () => {
    renderRoute('/dashboard')

    expect(screen.getByRole('heading', { name: 'Visão geral' })).toBeInTheDocument()
    expect(screen.getByText('Seu painel começa aqui')).toBeInTheDocument()
  })

  it('renders the requested order route', () => {
    renderRoute('/orders/ord-123')

    expect(screen.getByRole('heading', { name: 'Detalhes do pedido' })).toBeInTheDocument()
    expect(screen.getByText('ord-123')).toBeInTheDocument()
  })

  it('renders a fallback for unknown routes', () => {
    renderRoute('/unknown')

    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
  })
})
