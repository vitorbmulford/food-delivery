import { Bell, Menu } from 'lucide-react'
import { Avatar, Box, IconButton, Stack, Typography } from '@mui/material'

type AppHeaderProps = { onMenuClick: () => void }

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  return (
    <Box
      component="header"
      sx={{
        minHeight: 72,
        px: { xs: 2, sm: 3, lg: 4 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <IconButton
          aria-label="Abrir navegação"
          onClick={onMenuClick}
          sx={{ display: { md: 'none' } }}
        >
          <Menu size={20} />
        </IconButton>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: { xs: 'none', sm: 'block' } }}
        >
          Operação /{' '}
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
            Painel
          </Box>
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <IconButton aria-label="Notificações" size="small" sx={{ color: 'text.secondary' }}>
          <Bell size={19} />
        </IconButton>
        <Avatar
          sx={{
            width: 34,
            height: 34,
            bgcolor: 'primary.light',
            color: 'primary.dark',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          FD
        </Avatar>
      </Stack>
    </Box>
  )
}
