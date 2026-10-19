import { Fragment } from 'react'
import { useFieldArray, useForm, useWatch, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, Divider, Paper, Stack, TextField, Typography } from '@mui/material'
import { useNavigate } from 'react-router'
import { PageHeading } from '../components/ui/PageHeading'
import { useCreateOrder } from '../features/orders/hooks/useOrders'
import { DeliveryAddressFields } from '../features/orders/components/DeliveryAddressFields'
import { createOrderSchema, type CreateOrderForm } from '../features/orders/schemas/orderSchemas'
import type { CreateOrderInput } from '../features/orders/types/order'
import { formatCurrency } from '../features/orders/utils/orderFormat'
import { getOrderErrorMessage } from '../features/orders/utils/orderFormat'
import {
  formatCurrencyInput,
  getPriceLimitWarning,
  normalizeCurrencyInput,
} from '../features/orders/utils/sanitizeInput'

export function CreateOrderPage() {
  const navigate = useNavigate()
  const create = useCreateOrder()
  const form = useForm<CreateOrderForm, unknown, CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      items: [{ productName: '', quantity: '1', unitPrice: '' }],
      deliveryAddress: {
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        postalCode: '',
      },
    },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })
  const values = useWatch({ control: form.control, name: 'items' })
  const previewCents = values.reduce((sum, item) => {
    const price = Number(String(item.unitPrice).replace(',', '.'))
    const quantity = Number(item.quantity)
    return Number.isFinite(price) && price > 0 && Number.isFinite(quantity) && quantity > 0
      ? sum + Math.round(price * 100) * quantity
      : sum
  }, 0)

  const submit = form.handleSubmit(async (input) => {
    try {
      const order = await create.mutateAsync(input)
      navigate(`/orders/${order.id}`, { state: { created: true } })
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof error.response === 'object' &&
        error.response !== null &&
        'data' in error.response &&
        typeof error.response.data === 'object' &&
        error.response.data !== null &&
        'errors' in error.response.data &&
        typeof error.response.data.errors === 'object' &&
        error.response.data.errors !== null
      ) {
        for (const [field, message] of Object.entries(error.response.data.errors)) {
          const path = field.replace(/\[(\d+)\]/g, '.$1') as FieldPath<CreateOrderForm>
          if (typeof message === 'string') form.setError(path, { type: 'server', message })
        }
      }
    }
  })

  return (
    <>
      <PageHeading title="Novo pedido" description="Informe os itens e o endereço de entrega." />
      <Box component="form" onSubmit={submit} noValidate>
        <Stack spacing={2.5}>
          {create.isError && (
            <Alert severity="error">
              {getOrderErrorMessage(
                create.error,
                'Não foi possível criar o pedido. Revise os dados e tente novamente.',
              )}
            </Alert>
          )}
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={2}>
              <Typography variant="h3">Itens do pedido</Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(12, minmax(0, 1fr))' },
                  gap: 1.5,
                  alignItems: 'start',
                }}
              >
                {fields.map((field, index) => {
                  const productRegistration = form.register(`items.${index}.productName`)
                  const quantityRegistration = form.register(`items.${index}.quantity`)
                  const priceRegistration = form.register(`items.${index}.unitPrice`)
                  const unitPrice = values[index]?.unitPrice ?? ''
                  const priceLimitWarning = getPriceLimitWarning(unitPrice)
                  return (
                    <Fragment key={field.id}>
                      <TextField
                        label="Produto"
                        fullWidth
                        slotProps={{
                          htmlInput: {
                            maxLength: 160,
                            pattern: "[\\p{L}\\p{N}][\\p{L}\\p{N}\\s.'’&()+/,-]*",
                          },
                        }}
                        {...productRegistration}
                        error={Boolean(form.formState.errors.items?.[index]?.productName)}
                        helperText={form.formState.errors.items?.[index]?.productName?.message}
                        sx={{ gridColumn: { xs: 'span 1', sm: 'span 6' }, minWidth: 0 }}
                      />
                      <TextField
                        label="Quantidade"
                        inputMode="numeric"
                        slotProps={{ htmlInput: { maxLength: 10, pattern: '[1-9][0-9]{0,9}' } }}
                        {...quantityRegistration}
                        onChange={(event) => {
                          if (/^\d{0,10}$/.test(event.target.value))
                            void quantityRegistration.onChange(event)
                        }}
                        error={Boolean(form.formState.errors.items?.[index]?.quantity)}
                        helperText={form.formState.errors.items?.[index]?.quantity?.message}
                        sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' }, minWidth: 0 }}
                      />
                      <TextField
                        label="Preço unitário (R$)"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={formatCurrencyInput(unitPrice)}
                        slotProps={{
                          htmlInput: { maxLength: 21, pattern: '[0-9]{1,14}(,[0-9]{0,2})?' },
                          formHelperText: {
                            sx:
                              priceLimitWarning && !form.formState.errors.items?.[index]?.unitPrice
                                ? { color: 'warning.main' }
                                : undefined,
                          },
                        }}
                        {...priceRegistration}
                        onChange={(event) => {
                          event.target.value = normalizeCurrencyInput(event.target.value)
                          void priceRegistration.onChange(event)
                        }}
                        error={Boolean(form.formState.errors.items?.[index]?.unitPrice)}
                        helperText={
                          form.formState.errors.items?.[index]?.unitPrice?.message ??
                          priceLimitWarning
                        }
                        sx={{ gridColumn: { xs: 'span 1', sm: 'span 3' }, minWidth: 0 }}
                      />
                      <Button
                        color="error"
                        disabled={fields.length === 1 || create.isPending}
                        onClick={() => remove(index)}
                        aria-label={`Remover item ${index + 1}`}
                        sx={{
                          gridColumn: { xs: 'span 1', sm: 'span 1' },
                          alignSelf: 'center',
                          justifySelf: 'end',
                          minWidth: 0,
                          px: { sm: 0.5 },
                        }}
                      >
                        Remover
                      </Button>
                    </Fragment>
                  )
                })}
              </Box>
              {form.formState.errors.items?.root?.message && (
                <Alert severity="error">{form.formState.errors.items.root.message}</Alert>
              )}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 1 }}
              >
                <Button
                  variant="outlined"
                  onClick={() => append({ productName: '', quantity: '1', unitPrice: '' })}
                  disabled={create.isPending}
                >
                  Adicionar item
                </Button>
                <Typography aria-live="polite" sx={{ fontWeight: 700 }}>
                  Prévia do subtotal: {formatCurrency(previewCents / 100)}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                O total final será calculado pelo nosso sistema.
              </Typography>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={2}>
              <Typography variant="h3">Endereço de entrega</Typography>
              <DeliveryAddressFields form={form} />
            </Stack>
          </Paper>

          <Divider />
          <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => navigate('/orders')} disabled={create.isPending}>
              Voltar
            </Button>
            <Button type="submit" variant="contained" disabled={create.isPending}>
              {create.isPending ? 'Criando…' : 'Criar pedido'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </>
  )
}
