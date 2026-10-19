import { useCallback } from 'react'
import { Alert, Box, Button, CircularProgress, InputAdornment, TextField } from '@mui/material'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { useCepLookup } from '../hooks/useCepLookup'
import type { CreateOrderInput } from '../types/order'
import type { CreateOrderForm } from '../schemas/orderSchemas'
import { getCharacterLimitWarning, sanitizeInput } from '../utils/sanitizeInput'

const addressTextInputPattern = /^[\p{L}\p{N}\s.'’ºª°&()+/,-]*$/u
const houseNumberInputPattern = /^\d*$/
const complementInputPattern = /^[\p{L}\p{N}\s.'’ºª°#&()+/,-]*$/u
const stateInputPattern = /^[a-zA-Z]*$/

type Props = { form: UseFormReturn<CreateOrderForm, unknown, CreateOrderInput> }

function maskCep(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export function DeliveryAddressFields({ form }: Props) {
  const postalCode = useWatch({ control: form.control, name: 'deliveryAddress.postalCode' })
  const street = useWatch({ control: form.control, name: 'deliveryAddress.street' })
  const number = useWatch({ control: form.control, name: 'deliveryAddress.number' })
  const complement = useWatch({ control: form.control, name: 'deliveryAddress.complement' })
  const neighborhood = useWatch({ control: form.control, name: 'deliveryAddress.neighborhood' })
  const city = useWatch({ control: form.control, name: 'deliveryAddress.city' })
  const state = useWatch({ control: form.control, name: 'deliveryAddress.state' })
  const setValue = form.setValue
  const onAddressFound = useCallback(
    (address: { street: string; neighborhood: string; city: string; state: string }) => {
      setValue('deliveryAddress.street', address.street, {
        shouldDirty: true,
        shouldValidate: true,
      })
      setValue('deliveryAddress.neighborhood', address.neighborhood, {
        shouldDirty: true,
        shouldValidate: true,
      })
      setValue('deliveryAddress.city', address.city, { shouldDirty: true, shouldValidate: true })
      setValue('deliveryAddress.state', address.state.toUpperCase(), {
        shouldDirty: true,
        shouldValidate: true,
      })
    },
    [setValue],
  )
  const lookup = useCepLookup(postalCode, onAddressFound)
  const addressErrors = form.formState.errors.deliveryAddress
  const helperText =
    addressErrors?.postalCode?.message ??
    (lookup.state === 'loading'
      ? 'Consultando ViaCEP…'
      : lookup.state === 'success'
        ? 'Endereço localizado. Você pode editar os campos.'
        : lookup.state === 'not-found'
          ? 'CEP não encontrado. Preencha o endereço manualmente.'
          : lookup.state === 'error'
            ? 'Não foi possível consultar o CEP. Preencha manualmente ou tente novamente.'
            : undefined)
  const registration = form.register('deliveryAddress.postalCode')
  const streetRegistration = form.register('deliveryAddress.street')
  const numberRegistration = form.register('deliveryAddress.number')
  const complementRegistration = form.register('deliveryAddress.complement')
  const neighborhoodRegistration = form.register('deliveryAddress.neighborhood')
  const cityRegistration = form.register('deliveryAddress.city')
  const stateRegistration = form.register('deliveryAddress.state')
  const streetLimitWarning = getCharacterLimitWarning(street, 160)
  const numberLimitWarning = getCharacterLimitWarning(number, 10)
  const complementLimitWarning = getCharacterLimitWarning(complement, 120)
  const neighborhoodLimitWarning = getCharacterLimitWarning(neighborhood, 120)
  const cityLimitWarning = getCharacterLimitWarning(city, 120)

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(12, minmax(0, 1fr))' },
        gap: 1.5,
        alignItems: 'start',
      }}
    >
      <TextField
        label="CEP"
        placeholder="00000-000"
        autoComplete="postal-code"
        inputMode="numeric"
        value={postalCode}
        name={registration.name}
        onBlur={registration.onBlur}
        inputRef={registration.ref}
        onChange={(event) =>
          setValue('deliveryAddress.postalCode', maskCep(event.target.value), {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          })
        }
        error={Boolean(addressErrors?.postalCode)}
        helperText={helperText ?? ' '}
        slotProps={{
          htmlInput: { maxLength: 9, pattern: '\\d{5}-\\d{3}', 'aria-describedby': 'cep-helper' },
          input: {
            endAdornment:
              lookup.state === 'loading' ? (
                <InputAdornment position="end">
                  <CircularProgress size={16} aria-label="Consultando CEP" />
                </InputAdornment>
              ) : undefined,
          },
          formHelperText: { id: 'cep-helper', 'aria-live': 'polite' },
        }}
        sx={{ gridColumn: { xs: 'span 1', sm: 'span 3' }, minWidth: 0 }}
      />
      <TextField
        label="Rua"
        autoComplete="address-line1"
        slotProps={{
          htmlInput: { maxLength: 160, pattern: "[\\p{L}\\p{N}\\s.'’ºª°&()+/,-]*" },
          inputLabel: { shrink: Boolean(street) },
          formHelperText: {
            sx:
              streetLimitWarning && !addressErrors?.street ? { color: 'warning.main' } : undefined,
          },
        }}
        fullWidth
        {...streetRegistration}
        onChange={(event) =>
          sanitizeInput(event, streetRegistration.onChange, addressTextInputPattern, 160)
        }
        error={Boolean(addressErrors?.street)}
        helperText={addressErrors?.street?.message ?? streetLimitWarning ?? ' '}
        sx={{ gridColumn: { xs: 'span 1', sm: 'span 5' }, minWidth: 0 }}
      />
      <TextField
        label="Número"
        autoComplete="address-line2"
        inputMode="numeric"
        slotProps={{
          htmlInput: { maxLength: 10, pattern: '[0-9]{0,10}' },
          formHelperText: {
            sx:
              numberLimitWarning && !addressErrors?.number ? { color: 'warning.main' } : undefined,
          },
        }}
        fullWidth
        {...numberRegistration}
        onChange={(event) =>
          sanitizeInput(event, numberRegistration.onChange, houseNumberInputPattern, 10)
        }
        error={Boolean(addressErrors?.number)}
        helperText={addressErrors?.number?.message ?? numberLimitWarning ?? ' '}
        sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' }, minWidth: 0 }}
      />
      <TextField
        label="Complemento (opcional)"
        slotProps={{
          htmlInput: { maxLength: 120, pattern: "[\\p{L}\\p{N}\\s.'’ºª°#&()+/,-]*" },
          formHelperText: {
            sx:
              complementLimitWarning && !addressErrors?.complement
                ? { color: 'warning.main' }
                : undefined,
          },
        }}
        fullWidth
        {...complementRegistration}
        onChange={(event) =>
          sanitizeInput(event, complementRegistration.onChange, complementInputPattern, 120)
        }
        error={Boolean(addressErrors?.complement)}
        helperText={addressErrors?.complement?.message ?? complementLimitWarning ?? ' '}
        sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' }, minWidth: 0 }}
      />
      <TextField
        label="Bairro"
        autoComplete="address-level3"
        slotProps={{
          htmlInput: { maxLength: 120, pattern: "[\\p{L}\\p{N}\\s.'’ºª°&()+/,-]*" },
          inputLabel: { shrink: Boolean(neighborhood) },
          formHelperText: {
            sx:
              neighborhoodLimitWarning && !addressErrors?.neighborhood
                ? { color: 'warning.main' }
                : undefined,
          },
        }}
        fullWidth
        {...neighborhoodRegistration}
        onChange={(event) =>
          sanitizeInput(event, neighborhoodRegistration.onChange, addressTextInputPattern, 120)
        }
        error={Boolean(addressErrors?.neighborhood)}
        helperText={addressErrors?.neighborhood?.message ?? neighborhoodLimitWarning ?? ' '}
        sx={{ gridColumn: { xs: 'span 1', sm: 'span 5' }, minWidth: 0 }}
      />
      <TextField
        label="Cidade"
        autoComplete="address-level2"
        slotProps={{
          htmlInput: { maxLength: 120, pattern: "[\\p{L}\\p{N}\\s.'’ºª°&()+/,-]*" },
          inputLabel: { shrink: Boolean(city) },
          formHelperText: {
            sx: cityLimitWarning && !addressErrors?.city ? { color: 'warning.main' } : undefined,
          },
        }}
        fullWidth
        {...cityRegistration}
        onChange={(event) =>
          sanitizeInput(event, cityRegistration.onChange, addressTextInputPattern, 120)
        }
        error={Boolean(addressErrors?.city)}
        helperText={addressErrors?.city?.message ?? cityLimitWarning ?? ' '}
        sx={{ gridColumn: { xs: 'span 1', sm: 'span 5' }, minWidth: 0 }}
      />
      <TextField
        label="Estado (UF)"
        autoComplete="address-level1"
        slotProps={{
          htmlInput: { maxLength: 2, pattern: '[A-Za-z]{0,2}' },
          inputLabel: { shrink: Boolean(state) },
        }}
        fullWidth
        {...stateRegistration}
        onChange={(event) => sanitizeInput(event, stateRegistration.onChange, stateInputPattern, 2)}
        error={Boolean(addressErrors?.state)}
        helperText={addressErrors?.state?.message ?? ' '}
        sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' }, minWidth: 0 }}
      />
      {(lookup.state === 'not-found' || lookup.state === 'error') && (
        <Alert
          severity={lookup.state === 'not-found' ? 'warning' : 'info'}
          sx={{ gridColumn: '1 / -1' }}
          action={
            lookup.state === 'error' ? (
              <Button size="small" color="inherit" onClick={lookup.retry}>
                Tentar novamente
              </Button>
            ) : undefined
          }
        >
          {lookup.state === 'not-found'
            ? 'Não encontramos esse CEP. O endereço pode ser preenchido manualmente.'
            : 'A consulta ao ViaCEP falhou. Os campos continuam disponíveis para preenchimento manual.'}
        </Alert>
      )}
    </Box>
  )
}
