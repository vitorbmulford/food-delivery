import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Box, Drawer, IconButton, Typography, useMediaQuery, useTheme } from '@mui/material'
import { Outlet } from 'react-router'
import { Sidebar } from './Sidebar'
import { useAuth } from '../../features/auth/context/useAuth'
import { useOrderRealtimeStatus } from '../../features/orders/realtime/useOrderRealtimeStatus'

export const SIDEBAR_EXPANDED_WIDTH = 256
export const SIDEBAR_COLLAPSED_WIDTH = 76

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { isAuthenticated } = useAuth()
  const realtimeStatus = useOrderRealtimeStatus()
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{
            width: sidebarWidth,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.shorter,
            }),
            '& .MuiDrawer-paper': {
              width: sidebarWidth,
              boxSizing: 'border-box',
              borderRight: 1,
              borderColor: 'divider',
              overflowX: 'hidden',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.shorter,
              }),
            },
          }}
        >
          <Sidebar
            collapsed={collapsed}
            onNavigate={() => undefined}
            onToggle={() => setCollapsed((value) => !value)}
          />
        </Drawer>
      ) : (
        <>
          <IconButton
            aria-label="Abrir navegação"
            onClick={() => setMobileOpen(true)}
            sx={{ position: 'fixed', top: 12, left: 12, zIndex: theme.zIndex.appBar }}
          >
            <Menu size={21} />
          </IconButton>
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                width: SIDEBAR_EXPANDED_WIDTH,
                maxWidth: '85vw',
                borderRight: 1,
                borderColor: 'divider',
              },
            }}
          >
            <Sidebar
              collapsed={false}
              isMobile
              onNavigate={() => setMobileOpen(false)}
              onToggle={() => setMobileOpen(false)}
            />
          </Drawer>
        </>
      )}
      <Box
        component="main"
        sx={{
          minWidth: 0,
          minHeight: '100vh',
          ml: { md: `${sidebarWidth}px` },
          transition: theme.transitions.create('margin-left', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.shorter,
          }),
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 1440,
            mx: 'auto',
            p: { xs: 2.5, sm: 3, lg: 4 },
            pt: { xs: 8, sm: 8, md: 4 },
          }}
        >
          {isAuthenticated && (
            <Box
              aria-live="polite"
              aria-label={`Atualizações em tempo real: ${realtimeStatusLabel(realtimeStatus)}`}
              sx={{ display: 'flex', justifyContent: 'flex-end', minHeight: 20, mb: 1 }}
            >
              <Typography
                variant="caption"
                color={realtimeStatus === 'connected' ? 'success.main' : 'text.secondary'}
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
              >
                <Box
                  component="span"
                  aria-hidden="true"
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: realtimeStatus === 'connected' ? 'success.main' : 'warning.main',
                  }}
                />
                {realtimeStatusLabel(realtimeStatus)}
              </Typography>
            </Box>
          )}
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}

function realtimeStatusLabel(status: 'connected' | 'reconnecting' | 'disconnected') {
  if (status === 'connected') return 'Conectado'
  if (status === 'reconnecting') return 'Reconectando'
  return 'Desconectado'
}
