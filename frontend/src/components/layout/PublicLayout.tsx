import { Moon, Sun } from 'lucide-react'
import { Box, IconButton, Paper, Tooltip, useTheme } from '@mui/material'
import { Outlet } from 'react-router'
import { useColorMode } from '../../app/theme/ColorModeContext'

export function PublicLayout() {
  const { mode, toggleMode } = useColorMode()
  const theme = useTheme()

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'grid',
        placeItems: 'center',
        p: { xs: 2, sm: 3 },
      }}
    >
      <Tooltip title={mode === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}>
        <IconButton
          aria-label={mode === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          aria-pressed={mode === 'dark'}
          onClick={toggleMode}
          sx={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: theme.zIndex.tooltip,
            color: 'text.primary',
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          {mode === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </IconButton>
      </Tooltip>
      <Paper variant="outlined" sx={{ width: '100%', maxWidth: 480, p: { xs: 3, sm: 4 } }}>
        <Outlet />
      </Paper>
    </Box>
  )
}
