import { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  ChartNoAxesCombined,
  LogOut,
  Moon,
  Sun,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { NavLink, useNavigate } from 'react-router'
import { useAuth } from '../../features/auth/context/useAuth'
import { useColorMode } from '../../app/theme/ColorModeContext'

const navigation = [
  { label: 'Visão geral', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Pedidos', to: '/orders', icon: ClipboardList },
  { label: 'Insights', to: '/insights', icon: ChartNoAxesCombined },
]

type SidebarProps = {
  collapsed: boolean
  isMobile?: boolean
  onNavigate: () => void
  onToggle: () => void
}

export function Sidebar({ collapsed, isMobile = false, onNavigate, onToggle }: SidebarProps) {
  const { user, logout } = useAuth()
  const { mode, toggleMode } = useColorMode()
  const navigate = useNavigate()
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null)
  const nameParts = user?.name.trim().split(/\s+/) ?? []
  const initials =
    `${nameParts[0]?.[0] ?? user?.email[0] ?? 'U'}${nameParts.length > 1 ? (nameParts.at(-1)?.[0] ?? '') : ''}`.toLocaleUpperCase(
      'pt-BR',
    )

  const handleToggle = () => {
    setProfileAnchor(null)
    onToggle()
  }

  const handleLogout = async () => {
    setProfileAnchor(null)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <Box
      component="aside"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        px: collapsed ? 1 : 2,
        py: 2,
        overflowX: 'hidden',
      }}
    >
      <Stack
        direction={collapsed ? 'column' : 'row'}
        spacing={1}
        sx={{
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: collapsed ? 88 : 44,
          mb: 3,
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          sx={{
            alignItems: 'center',
            minWidth: 0,
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <Box
            aria-label="Foody Delivery"
            sx={{
              width: 40,
              height: 40,
              flexShrink: 0,
              bgcolor: 'primary.main',
              color: 'common.white',
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <UtensilsCrossed size={21} strokeWidth={2.2} />
          </Box>
          {!collapsed && (
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h3" sx={{ lineHeight: 1.1 }}>
                Foody
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.06em' }}>
                DELIVERY
              </Typography>
            </Box>
          )}
        </Stack>
        {!isMobile && (
          <Tooltip title={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}>
            <IconButton
              aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
              onClick={handleToggle}
              size="small"
              sx={{ flexShrink: 0 }}
            >
              {collapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}
            </IconButton>
          </Tooltip>
        )}
        {isMobile && (
          <IconButton aria-label="Fechar navegação" onClick={handleToggle} size="small">
            <X size={19} />
          </IconButton>
        )}
      </Stack>

      {!collapsed && (
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ px: 1.25, mb: 1, fontWeight: 700, letterSpacing: '0.1em' }}
        >
          Workspace
        </Typography>
      )}
      <Stack component="nav" aria-label="Navegação principal" spacing={0.75}>
        {navigation.map(({ label, to, icon: Icon }) => (
          <Tooltip key={to} title={collapsed ? label : ''} placement="right">
            <Box component="span" sx={{ display: 'block' }}>
              <Box
                component={NavLink}
                to={to}
                onClick={onNavigate}
                aria-label={label}
                title={collapsed ? label : undefined}
                sx={{
                  minHeight: 44,
                  width: '100%',
                  px: collapsed ? 0 : 1.25,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
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
                {!collapsed && (
                  <Typography variant="body2" component="span" sx={{ fontWeight: 'inherit' }}>
                    {label}
                  </Typography>
                )}
              </Box>
            </Box>
          </Tooltip>
        ))}
      </Stack>

      <Box sx={{ mt: 'auto' }}>
        <Tooltip
          title={mode === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          placement="right"
        >
          <IconButton
            aria-label={mode === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
            aria-pressed={mode === 'dark'}
            onClick={toggleMode}
            sx={{
              width: '100%',
              minHeight: 44,
              mb: 1,
              borderRadius: 2,
              justifyContent: collapsed ? 'center' : 'flex-start',
              px: collapsed ? 0 : 1.25,
              color: 'text.secondary',
            }}
          >
            {mode === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            {!collapsed && (
              <Typography variant="body2" sx={{ ml: 1.5 }}>
                {mode === 'dark' ? 'Modo claro' : 'Modo escuro'}
              </Typography>
            )}
          </IconButton>
        </Tooltip>
        <Divider sx={{ mb: 1.5 }} />
        <Tooltip title={collapsed ? 'Perfil' : ''} placement="right">
          <IconButton
            aria-label="Abrir menu do usuário"
            aria-haspopup="menu"
            aria-expanded={Boolean(profileAnchor)}
            onClick={(event) => setProfileAnchor(event.currentTarget)}
            sx={{
              width: '100%',
              minHeight: collapsed ? 48 : 64,
              borderRadius: 2,
              justifyContent: collapsed ? 'center' : 'flex-start',
              px: collapsed ? 0 : 1,
            }}
          >
            <Avatar
              aria-hidden="true"
              sx={{
                width: 36,
                height: 36,
                bgcolor: 'primary.light',
                color: 'primary.dark',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {initials}
            </Avatar>
            {!collapsed && (
              <Stack sx={{ ml: 1.25, minWidth: 0, alignItems: 'flex-start' }}>
                <Typography
                  variant="body2"
                  sx={{
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                  }}
                >
                  {user?.name}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {user?.email}
                </Typography>
              </Stack>
            )}
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={profileAnchor}
          open={Boolean(profileAnchor)}
          onClose={() => setProfileAnchor(null)}
          anchorOrigin={{ vertical: 'top', horizontal: collapsed ? 'right' : 'center' }}
          transformOrigin={{ vertical: 'bottom', horizontal: collapsed ? 'left' : 'center' }}
          slotProps={{
            paper: {
              sx: {
                width: 224,
                minWidth: 0,
                maxWidth: 'calc(100vw - 32px)',
                boxSizing: 'border-box',
                borderRadius: 2.5,
                overflow: 'hidden',
              },
            },
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: 'center',
              width: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
              px: 1.5,
              py: 2,
            }}
          >
            <Avatar
              aria-hidden="true"
              sx={{
                width: 40,
                height: 40,
                flexShrink: 0,
                bgcolor: 'primary.light',
                color: 'primary.dark',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {initials}
            </Avatar>
            <Stack sx={{ flex: '1 1 0%', minWidth: 0, alignItems: 'flex-start' }}>
              <Typography
                variant="body2"
                sx={{
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 700,
                }}
              >
                {user?.name}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.email}
              </Typography>
            </Stack>
          </Stack>
          <Divider />
          <MenuItem onClick={handleLogout} sx={{ justifyContent: 'center', gap: 1, py: 1.25 }}>
            <LogOut size={17} />
            Sair
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  )
}
