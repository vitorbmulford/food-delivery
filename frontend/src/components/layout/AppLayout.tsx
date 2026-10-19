import { useState } from 'react'
import { Box, Drawer, useMediaQuery, useTheme } from '@mui/material'
import { Outlet } from 'react-router'
import { AppHeader } from './AppHeader'
import { Sidebar } from './Sidebar'

export const SIDEBAR_WIDTH = 256

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))

  const sidebar = <Sidebar onNavigate={() => setMobileOpen(false)} />

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: SIDEBAR_WIDTH,
              boxSizing: 'border-box',
              borderRight: 1,
              borderColor: 'divider',
            },
          }}
        >
          {sidebar}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH, maxWidth: '85vw' },
          }}
        >
          {sidebar}
        </Drawer>
      )}
      <Box
        component="main"
        sx={{
          minWidth: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          ml: { md: `${SIDEBAR_WIDTH}px` },
        }}
      >
        <AppHeader onMenuClick={() => setMobileOpen(true)} />
        <Box
          sx={{
            width: '100%',
            maxWidth: 1440,
            mx: 'auto',
            p: { xs: 2.5, sm: 3, lg: 4 },
            flex: 1,
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
