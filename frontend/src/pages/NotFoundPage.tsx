import { SearchX } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { Button, Stack } from '@mui/material'
import { PageHeading } from '../components/ui/PageHeading'
import { PlaceholderPanel } from '../components/ui/PlaceholderPanel'

export function NotFoundPage() {
  return (
    <>
      <PageHeading
        title="Página não encontrada"
        description="O endereço acessado não corresponde a uma página disponível."
      />
      <Stack spacing={2} sx={{ alignItems: 'center' }}>
        <PlaceholderPanel
          icon={<SearchX size={22} />}
          title="Nada por aqui"
          description="Confira o endereço ou volte para o painel principal."
        />
        <Button component={RouterLink} to="/dashboard" variant="contained">
          Ir para visão geral
        </Button>
      </Stack>
    </>
  )
}
