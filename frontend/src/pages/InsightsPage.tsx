import { BarChart3, Clock3, Lightbulb } from 'lucide-react'
import { Box, Paper, Stack, Typography } from '@mui/material'
import { PageHeading } from '../components/ui/PageHeading'

export function InsightsPage() {
  return (
    <>
      <PageHeading
        title="Insights"
        description="Relatórios analíticos para entender os resultados do seu delivery."
      />
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 3, sm: 5 },
          minHeight: 300,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
        }}
      >
        <Stack spacing={1.5} sx={{ maxWidth: 500, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main', mb: 1 }}>
            <BarChart3 size={26} />
            <Clock3 size={20} />
          </Box>
          <Typography variant="h2">Relatórios analíticos em breve</Typography>
          <Typography color="text.secondary">
            Esta área será dedicada a análises financeiras, comerciais e de desempenho, como
            evolução dos pedidos, produtos vendidos e tempos de preparo e entrega.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, color: 'text.secondary' }}>
            <Lightbulb size={16} />
            <Typography variant="caption">
              Os relatórios serão exibidos quando houver dados adequados para calculá-los.
            </Typography>
          </Stack>
        </Stack>
      </Paper>
    </>
  )
}
