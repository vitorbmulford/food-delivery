import { Link as RouterLink } from 'react-router'
import { Link, Paper, Stack, Typography } from '@mui/material'
import { PageHeading } from '../components/ui/PageHeading'
import { PlaceholderPanel } from '../components/ui/PlaceholderPanel'

export function RegisterPage() {
  return (
    <>
      <PageHeading
        title="Criar acesso"
        description="Prepare seu acesso ao painel de gestão do Foody Delivery."
      />
      <Stack spacing={2}>
        <PlaceholderPanel
          title="Cadastro em preparação"
          description="O formulário de cadastro será conectado ao backend em uma próxima etapa."
          icon={<span aria-hidden="true">＋</span>}
        />
        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            Já possui acesso?{' '}
            <Link component={RouterLink} to="/login" underline="hover">
              Entrar
            </Link>
          </Typography>
        </Paper>
      </Stack>
    </>
  )
}
