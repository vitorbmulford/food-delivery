import { Bike, ClipboardList, LayoutDashboard, UtensilsCrossed } from 'lucide-react'
import { Box, ButtonBase, Divider, Stack, Typography } from '@mui/material'
import { NavLink } from 'react-router'

const navigation = [
  { label: 'Visão geral', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Pedidos', to: '/orders', icon: ClipboardList },
]

type SidebarProps = { onNavigate: () => void }

export function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <Box
      component="aside"
      sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2.5 }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', px: 0.5, py: 1.25, mb: 3 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            bgcolor: 'primary.main',
            color: 'common.white',
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <UtensilsCrossed size={21} strokeWidth={2.2} />
        </Box>
        <Box>
          <Typography variant="h3" sx={{ lineHeight: 1.1 }}>
            foody
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.06em' }}>
            DELIVERY
          </Typography>
        </Box>
      </Stack>

      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ px: 1.25, mb: 1, fontWeight: 700, letterSpacing: '0.1em' }}
      >
        Workspace
      </Typography>
      <Stack component="nav" aria-label="Navegação principal" spacing={0.5}>
        {navigation.map(({ label, to, icon: Icon }) => (
          <ButtonBase
            key={to}
            component={NavLink}
            to={to}
            onClick={onNavigate}
            sx={{
              minHeight: 44,
              width: '100%',
              px: 1.25,
              justifyContent: 'flex-start',
              gap: 1.5,
              borderRadius: 2,
              color: 'text.secondary',
              textDecoration: 'none',
              '&.active': {
                color: 'primary.dark',
                bgcolor: 'primary.light',
                fontWeight: 700,
              },
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Icon size={19} strokeWidth={1.9} />
            <Typography variant="body2" component="span" sx={{ fontWeight: 'inherit' }}>
              {label}
            </Typography>
          </ButtonBase>
        ))}
      </Stack>

      <Box sx={{ mt: 'auto' }}>
        <Divider sx={{ mb: 2 }} />
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2.5,
            bgcolor: '#f7f8f6',
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
            <Bike size={17} color="#1f6b4f" />
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>
              Central de operação
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Seu espaço para acompanhar a operação de delivery.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
