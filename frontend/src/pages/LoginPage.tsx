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
import { Link as RouterLink, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../features/auth/context/useAuth'
import { loginSchema, type LoginFormValues } from '../features/auth/schemas/authSchemas'
import { getApiErrorMessage } from '../lib/api/client'

export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const registrationSuccess = Boolean(
    (location.state as { registrationSuccess?: boolean } | null)?.registrationSuccess,
  )
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const submit = handleSubmit(async ({ email, password }) => {
    setSubmitError('')
    try {
      await auth.login({ email, password })
      const from = (location.state as { from?: unknown } | null)?.from
      const destination =
        typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
          ? from
          : '/dashboard'
      navigate(destination, { replace: true })
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Não foi possível entrar. Tente novamente.'))
    }
  })

  return (
    <Stack spacing={3}>
      <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
        <UtensilsCrossed size={32} color="#d40101" aria-hidden="true" />
        <Typography variant="h1">Entrar</Typography>
        <Typography color="text.secondary">Acesse o painel de gestão do Foody Delivery.</Typography>
      </Stack>
      {registrationSuccess && (
        <Alert severity="success">Cadastro realizado. Entre com seu e-mail e senha.</Alert>
      )}
      {submitError && (
        <Alert severity="error" role="alert">
          {submitError}
        </Alert>
      )}
      <Stack component="form" spacing={2} onSubmit={submit} noValidate>
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          autoFocus
          fullWidth
          {...register('email')}
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
        />
        <TextField
          label="Senha"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          fullWidth
          {...register('password')}
          error={Boolean(errors.password)}
          helperText={errors.password?.message}
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
        <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
        Ainda não tem acesso?{' '}
        <Link component={RouterLink} to="/register" underline="hover">
          Criar cadastro
        </Link>
      </Typography>
    </Stack>
  )
}
