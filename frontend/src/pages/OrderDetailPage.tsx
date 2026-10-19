import { ClipboardList } from 'lucide-react'
import { Paper, Stack, Typography } from '@mui/material'
import { useParams } from 'react-router'
import { PageHeading } from '../components/ui/PageHeading'
import { PlaceholderPanel } from '../components/ui/PlaceholderPanel'

export function OrderDetailPage() {
  const { id } = useParams()

  return (
    <>
      <PageHeading
        title="Detalhes do pedido"
        description="Acompanhe as informações e o andamento deste pedido."
      />
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            Identificador da rota
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {id}
          </Typography>
        </Paper>
        <PlaceholderPanel
          icon={<ClipboardList size={22} />}
          title="Detalhes aguardando integração"
          description="Os dados deste pedido serão carregados quando a integração com a API estiver implementada."
        />
      </Stack>
    </>
  )
}
