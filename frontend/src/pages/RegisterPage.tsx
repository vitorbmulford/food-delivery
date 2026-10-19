import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Button,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Eye, EyeOff, UtensilsCrossed } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link as RouterLink, useNavigate } from 'react-router'
import { register as registerUser } from '../features/auth/api/authApi'
import { registerSchema, type RegisterFormValues } from '../features/auth/schemas/authSchemas'
import { getApiErrorMessage } from '../lib/api/client'

export function RegisterPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  const submit = handleSubmit(async ({ name, email, password }) => {
    setSubmitError('')
    try {
      await registerUser({ name, email, password })
      navigate('/login', { replace: true, state: { registrationSuccess: true } })
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const response = (
          error as { response?: { status?: number; data?: { errors?: Record<string, string> } } }
        ).response
        if (response?.status === 400 && response.data?.errors) {
          for (const field of Object.keys(response.data.errors)) {
            if (field === 'name') {
              setError(field, { type: 'server', message: 'Informe um nome válido.' })
            } else if (field === 'email') {
              setError(field, { type: 'server', message: 'Informe um e-mail válido.' })
            } else if (field === 'password') {
              setError(field, {
                type: 'server',
                message: 'A senha não atende aos requisitos informados.',
              })
            }
          }
        }
      }
      setSubmitError(
        getApiErrorMessage(error, 'Não foi possível criar o cadastro. Tente novamente.'),
      )
    }
  })

  return (
    <Stack spacing={3}>
      <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
        <UtensilsCrossed size={32} color="#d40101" aria-hidden="true" />
        <Typography variant="h1">Criar acesso</Typography>
        <Typography color="text.secondary">Cadastre-se para acessar o Foody Delivery.</Typography>
      </Stack>
      {submitError && (
        <Alert severity="error" role="alert">
          {submitError}
        </Alert>
      )}
      <Stack component="form" spacing={2} onSubmit={submit} noValidate>
        <TextField
          label="Nome"
          autoComplete="name"
          autoFocus
          fullWidth
          {...register('name')}
          error={Boolean(errors.name)}
          helperText={errors.name?.message}
        />
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          fullWidth
          {...register('email')}
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
        />
        <TextField
          label="Senha"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          fullWidth
          {...register('password')}
          error={Boolean(errors.password)}
          helperText={
            errors.password?.message ??
            '8 a 72 caracteres, com maiúscula, minúscula, número e símbolo.'
          }
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setShowPassword((visible) => !visible)}
                    edge="end"
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          label="Confirmar senha"
          type={showConfirmation ? 'text' : 'password'}
          autoComplete="new-password"
          fullWidth
          {...register('confirmPassword')}
          error={Boolean(errors.confirmPassword)}
          helperText={errors.confirmPassword?.message}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showConfirmation ? 'Ocultar confirmação' : 'Mostrar confirmação'}
                    onClick={() => setShowConfirmation((visible) => !visible)}
                    edge="end"
                  >
                    {showConfirmation ? <EyeOff size={19} /> : <Eye size={19} />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
          {isSubmitting ? 'Criando acesso…' : 'Criar acesso'}
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
        Já possui acesso?{' '}
        <Link component={RouterLink} to="/login" underline="hover">
          Entrar
        </Link>
      </Typography>
    </Stack>
  )
}
