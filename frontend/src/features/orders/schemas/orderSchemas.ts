import { z } from 'zod'

const productNamePattern = /^[\p{L}\p{N}][\p{L}\p{N}\s.'’&()+/,-]*$/u
const addressTextPattern = /^[\p{L}\p{N}][\p{L}\p{N}\s.'’ºª°&()+/,-]*$/u
const houseNumberPattern = /^\d{1,10}$/
const complementPattern = /^$|^[\p{L}\p{N}][\p{L}\p{N}\s.'’ºª°#&()+/,-]*$/u

const customerSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do cliente.').max(120, 'Use até 120 caracteres.'),
  phone: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .pipe(z.string().regex(/^\d{10,11}$/, 'Informe um telefone brasileiro válido com DDD.')),
  email: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : value))
    .pipe(
      z.string().email('Informe um e-mail válido.').max(320, 'Use até 320 caracteres.').nullable(),
    ),
})

const moneyInput = z
  .string()
  .trim()
  .regex(
    /^\d{1,14}(?:,\d{1,2})?$/,
    'Informe um valor numérico com até 14 dígitos e duas casas decimais.',
  )
  .transform((value) => Number(value.replace(',', '.')))
  .pipe(
    z
      .number()
      .finite()
      .min(0.01, 'O preço deve ser maior que zero.')
      .max(Number.MAX_SAFE_INTEGER / 100, 'O preço excede o limite de precisão seguro.'),
  )

const itemSchema = z
  .object({
    productName: z
      .string()
      .trim()
      .min(1, 'Informe o produto.')
      .max(160, 'Use até 160 caracteres.')
      .regex(productNamePattern, 'Use letras, números e pontuação comum no nome do produto.'),
    quantity: z
      .string()
      .regex(/^[1-9]\d{0,9}$/, 'Informe uma quantidade inteira, sem sinais ou casas decimais.')
      .transform(Number)
      .pipe(
        z
          .number()
          .int('Use uma quantidade inteira.')
          .min(1, 'A quantidade mínima é 1.')
          .max(2_147_483_647, 'A quantidade máxima é 2.147.483.647.'),
      ),
    unitPrice: moneyInput,
  })
  .superRefine((item, context) => {
    const subtotalCents = Math.round(item.unitPrice * 100) * item.quantity
    if (!Number.isSafeInteger(subtotalCents)) {
      context.addIssue({
        code: 'custom',
        path: ['unitPrice'],
        message: 'O subtotal excede o limite de precisão seguro.',
      })
    }
  })

export const createOrderSchema = z
  .object({
    customer: customerSchema,
    items: z.array(itemSchema).min(1, 'Adicione ao menos um item.'),
    deliveryAddress: z.object({
      street: z
        .string()
        .trim()
        .min(1, 'Informe a rua.')
        .max(160, 'Use até 160 caracteres.')
        .regex(addressTextPattern, 'Use letras, números e pontuação comum no nome da rua.'),
      number: z
        .string()
        .trim()
        .min(1, 'Informe o número.')
        .max(10, 'Use até 10 dígitos no número.')
        .regex(houseNumberPattern, 'Informe apenas números no endereço.'),
      complement: z
        .string()
        .trim()
        .max(120, 'Use até 120 caracteres.')
        .regex(complementPattern, 'Use letras, números e pontuação comum no complemento.'),
      neighborhood: z
        .string()
        .trim()
        .min(1, 'Informe o bairro.')
        .max(120, 'Use até 120 caracteres.')
        .regex(addressTextPattern, 'Use letras, números e pontuação comum no bairro.'),
      city: z
        .string()
        .trim()
        .min(1, 'Informe a cidade.')
        .max(120, 'Use até 120 caracteres.')
        .regex(addressTextPattern, 'Use letras, números e pontuação comum no nome da cidade.'),
      state: z
        .string()
        .trim()
        .transform((value) => value.toUpperCase())
        .pipe(
          z.string().regex(/^[A-Z]{2}$/, 'Informe a sigla do estado com exatamente duas letras.'),
        ),
      postalCode: z.string().regex(/^\d{5}-\d{3}$/, 'Informe o CEP no formato 00000-000.'),
    }),
  })
  .superRefine((order, context) => {
    const totalCents = order.items.reduce(
      (total, item) => total + Math.round(item.unitPrice * 100) * item.quantity,
      0,
    )
    if (!Number.isSafeInteger(totalCents)) {
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'O total excede o limite de precisão seguro.',
      })
    }
  })

export type CreateOrderForm = z.input<typeof createOrderSchema>
