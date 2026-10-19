import { Stack, Typography } from '@mui/material'

type PageHeadingProps = { title: string; description: string }

export function PageHeading({ title, description }: PageHeadingProps) {
  return (
    <Stack spacing={0.75} sx={{ mb: 3.5 }}>
      <Typography component="h1" variant="h1">
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        {description}
      </Typography>
    </Stack>
  )
}
