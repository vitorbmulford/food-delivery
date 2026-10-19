import { Link as RouterLink } from 'react-router'
import { Link, Paper, Stack, Typography } from '@mui/material'
import { PageHeading } from '../components/ui/PageHeading'
import { PlaceholderPanel } from '../components/ui/PlaceholderPanel'

export function LoginPage() {
  return (
    <>
      <PageHeading title="Entrar" description="Acesse o painel de gestão do Foody Delivery." />
      <Stack spacing={2}>
        <PlaceholderPanel
          title="Acesso em preparação"
          description="O formulário de autenticação será conectado ao backend em uma próxima etapa."
          icon={<span aria-hidden="true">↗</span>}
        />
        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            Ainda não tem acesso?{' '}
            <Link component={RouterLink} to="/register" underline="hover">
              Criar cadastro
            </Link>
          </Typography>
        </Paper>
      </Stack>
    </>
  )
}
