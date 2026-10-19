import {
  Alert,
  Button,
  Step,
  StepButton,
  Stepper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { ArrowDown } from 'lucide-react'
import type { OrderStatus } from '../types/order'
import { orderStatusLabels } from '../types/order'

const flow: OrderStatus[] = ['RECEBIDO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA', 'ENTREGUE']

export function OrderProgress({
  status,
  onViewHistory,
}: {
  status: OrderStatus
  onViewHistory: () => void
}) {
  const theme = useTheme()
  const compact = useMediaQuery(theme.breakpoints.down('sm'))
  if (status === 'CANCELADO') {
    return (
      <Stack spacing={1}>
        <Alert severity="error">
          <Typography sx={{ fontWeight: 700 }}>Pedido cancelado</Typography>O pedido foi encerrado
          antes da conclusão da entrega.
        </Alert>
        <Button
          onClick={onViewHistory}
          startIcon={<ArrowDown size={18} />}
          sx={{ alignSelf: 'flex-start' }}
        >
          Ver histórico do pedido
        </Button>
      </Stack>
    )
  }

  const activeStep = flow.indexOf(status)
  return (
    <>
      <Typography variant="h3" component="h2">
        Andamento do pedido
      </Typography>
      <Stepper
        activeStep={activeStep}
        alternativeLabel={!compact}
        orientation={compact ? 'vertical' : 'horizontal'}
        sx={{ pt: 2, pb: 1 }}
      >
        {flow.map((step) => (
          <Step key={step} completed={flow.indexOf(step) < activeStep}>
            <StepButton
              aria-label={`Ver histórico de status. Etapa ${orderStatusLabels[step]}`}
              onClick={onViewHistory}
            >
              {orderStatusLabels[step]}
            </StepButton>
          </Step>
        ))}
      </Stepper>
      <Typography variant="body2" color="text.secondary">
        Etapas do fluxo. Consulte o histórico para ver as alterações em mais detalhes registrados.
      </Typography>
      <Button
        onClick={onViewHistory}
        startIcon={<ArrowDown size={18} />}
        sx={{ alignSelf: 'flex-start' }}
      >
        Ver histórico do pedido
      </Button>
    </>
  )
}
