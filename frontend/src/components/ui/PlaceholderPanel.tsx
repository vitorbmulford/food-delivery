import { Box, Paper, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'

type PlaceholderPanelProps = {
  icon: ReactNode
  title: string
  description: string
}

export function PlaceholderPanel({ icon, title, description }: PlaceholderPanelProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 3, sm: 4 },
        minHeight: 224,
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        borderColor: 'divider',
      }}
    >
      <Stack spacing={1.25} sx={{ maxWidth: 440, alignItems: 'center' }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            display: 'grid',
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: 'primary.light',
            borderRadius: 3,
          }}
        >
          {icon}
        </Box>
        <Typography variant="h3">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Stack>
    </Paper>
  )
}
