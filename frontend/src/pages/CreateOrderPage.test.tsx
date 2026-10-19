import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateOrderPage } from './CreateOrderPage'

const { createOrder } = vi.hoisted(() => ({ createOrder: vi.fn() }))
vi.mock('../features/orders/api/ordersApi', () => ({
  createOrder,
  listOrders: vi.fn(),
  getOrder: vi.fn(),
  updateOrderStatus: vi.fn(),
}))

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/orders/new']}>
        <Routes>
          <Route path="/orders/new" element={<CreateOrderPage />} />
          <Route path="/orders/:id" element={<h1>Pedido criado</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

describe('formulário de pedidos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('usa padrões HTML válidos no modo Unicode para produto e endereço', () => {
    renderForm()
    const fields = [
      screen.getByLabelText('Produto'),
      screen.getByLabelText('Rua'),
      screen.getByLabelText('Complemento (opcional)'),
      screen.getByLabelText('Bairro'),
      screen.getByLabelText('Cidade'),
    ]

    for (const field of fields) {
      const pattern = field.getAttribute('pattern')
      expect(pattern).not.toBeNull()
      expect(() => new RegExp(pattern ?? '', 'v')).not.toThrow()
    }

    const productPattern = new RegExp(fields[0]?.getAttribute('pattern') ?? '', 'v')
    expect(productPattern.test('Pão (combo)/2 - especial')).toBe(true)
  })

  it('valida os campos obrigatórios e exige um item válido', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Criar pedido' }))
    expect(await screen.findByText('Informe o nome do cliente.')).toBeInTheDocument()
    expect(screen.getByText('Informe um telefone brasileiro válido com DDD.')).toBeInTheDocument()
    expect(await screen.findByText('Informe o produto.')).toBeInTheDocument()
    expect(screen.getByText('Informe a rua.')).toBeInTheDocument()
    expect(createOrder).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Produto'), 'Lanche')
    await user.clear(screen.getByLabelText('Quantidade'))
    await user.type(screen.getByLabelText('Quantidade'), '0')
    await user.clear(screen.getByLabelText('Preço unitário (R$)'))
    await user.type(screen.getByLabelText('Preço unitário (R$)'), 'abc')
    expect(screen.getByLabelText('Preço unitário (R$)')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Criar pedido' }))
    expect(
      await screen.findByText('Informe uma quantidade inteira, sem sinais ou casas decimais.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Informe um valor numérico com até 14 dígitos e duas casas decimais.'),
    ).toBeInTheDocument()
    expect(createOrder).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Adicionar item' }))
    expect(screen.getAllByLabelText('Produto')[0]).toHaveValue('Lanche')
    expect(screen.getAllByLabelText('Produto')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Remover item 2' }))
    expect(screen.getAllByLabelText('Produto')).toHaveLength(1)
  })

  it('restringe preço e número a dígitos e limita os campos ao tamanho permitido', async () => {
    const user = userEvent.setup()
    renderForm()
    const price = screen.getByLabelText('Preço unitário (R$)')
    const number = screen.getByLabelText('Número')
    const street = screen.getByLabelText('Rua')

    await user.type(price, '1a2,34')
    await user.type(number, '12a34')
    await user.type(street, 'A'.repeat(170))

    expect(price).toHaveValue('12,34')
    expect(price).toHaveAttribute('pattern', '[0-9]{1,14}(,[0-9]{0,2})?')
    expect(number).toHaveValue('1234')
    expect(street).toHaveValue('A'.repeat(160))
    expect(screen.getByText('Limite máximo de 160 caracteres atingido.')).toBeInTheDocument()

    await user.clear(price)
    await user.type(price, '10002030130210')
    await user.type(price, '5')
    expect(price).toHaveValue('10.002.030.130.210')
    expect(
      screen.getByText(
        'Limite de 14 dígitos inteiros atingido. Ainda é possível informar até 2 casas decimais.',
      ),
    ).toBeInTheDocument()
    await user.type(price, ',99')
    expect(price).toHaveValue('10.002.030.130.210,99')
  })

  it('mascara o CEP e preenche rua, bairro, cidade e UF deixando tudo editável', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          logradouro: 'Praça da Sé',
          bairro: 'Sé',
          localidade: 'São Paulo',
          uf: 'SP',
        }),
      }),
    )
    renderForm()
    await user.type(screen.getByLabelText('CEP'), '01001000')

    expect(await screen.findByDisplayValue('Praça da Sé')).toBeInTheDocument()
    expect(screen.getByLabelText('CEP')).toHaveValue('01001-000')
    expect(screen.getByLabelText('Bairro')).toHaveValue('Sé')
    expect(screen.getByLabelText('Cidade')).toHaveValue('São Paulo')
    expect(screen.getByLabelText('Estado (UF)')).toHaveValue('SP')
    for (const label of ['Rua', 'Bairro', 'Cidade', 'Estado (UF)']) {
      const input = screen.getByLabelText(label)
      expect(document.querySelector(`label[for="${input.id}"]`)).toHaveAttribute(
        'data-shrink',
        'true',
      )
    }
    expect(screen.getByLabelText('Número')).toBeEnabled()
    expect(screen.getByLabelText('Complemento (opcional)')).toBeEnabled()
    await user.clear(screen.getByLabelText('Rua'))
    await user.type(screen.getByLabelText('Rua'), 'Rua editada manualmente')
    expect(screen.getByLabelText('Rua')).toHaveValue('Rua editada manualmente')
    expect(fetch).toHaveBeenCalledWith('https://viacep.com.br/ws/01001000/json/', expect.anything())
  })

  it('envia DTO validado, permite remover item adicional e mostra sucesso', async () => {
    const user = userEvent.setup()
    createOrder.mockResolvedValue({ id: 'order-123' })
    renderForm()
    await user.type(screen.getByLabelText('Nome completo'), 'Maria Silva')
    await user.type(screen.getByLabelText('Telefone'), '11999999999')
    await user.type(screen.getByLabelText('E-mail (opcional)'), 'maria@example.com')
    await user.type(screen.getByLabelText('Produto'), 'Marmita')
    await user.clear(screen.getByLabelText('Quantidade'))
    await user.type(screen.getByLabelText('Quantidade'), '2')
    await user.type(screen.getByLabelText('Preço unitário (R$)'), '24,90')
    await user.type(screen.getByLabelText('Rua'), 'Rua das Flores')
    await user.type(screen.getByLabelText('Número'), '120')
    await user.type(screen.getByLabelText('Bairro'), 'Centro')
    await user.type(screen.getByLabelText('Cidade'), 'São Paulo')
    await user.type(screen.getByLabelText('Estado (UF)'), 'SP')
    await user.type(screen.getByLabelText('CEP'), '01001000')
    await user.click(screen.getByRole('button', { name: 'Criar pedido' }))

    await screen.findByRole('heading', { name: 'Pedido criado' })
    await waitFor(() =>
      expect(createOrder).toHaveBeenCalledWith({
        customer: { name: 'Maria Silva', phone: '11999999999', email: 'maria@example.com' },
        items: [{ productName: 'Marmita', quantity: 2, unitPrice: 24.9 }],
        deliveryAddress: {
          street: 'Rua das Flores',
          number: '120',
          complement: '',
          neighborhood: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          postalCode: '01001-000',
        },
      }),
    )
  })

  it('mantém dados e mostra erro quando API rejeita a criação', async () => {
    const user = userEvent.setup()
    createOrder.mockRejectedValue({ isAxiosError: true, response: { status: 409 } })
    renderForm()
    await user.type(screen.getByLabelText('Nome completo'), 'Maria Silva')
    await user.type(screen.getByLabelText('Telefone'), '11999999999')
    await user.type(screen.getByLabelText('Produto'), 'Marmita')
    await user.type(screen.getByLabelText('Preço unitário (R$)'), '10,00')
    await user.type(screen.getByLabelText('Rua'), 'Rua A')
    await user.type(screen.getByLabelText('Número'), '1')
    await user.type(screen.getByLabelText('Bairro'), 'Centro')
    await user.type(screen.getByLabelText('Cidade'), 'São Paulo')
    await user.type(screen.getByLabelText('Estado (UF)'), 'SP')
    await user.type(screen.getByLabelText('CEP'), '01001000')
    await user.click(screen.getByRole('button', { name: 'Criar pedido' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O pedido foi alterado em outra operação.',
    )
    expect(screen.getByLabelText('Produto')).toHaveValue('Marmita')
  })
})
