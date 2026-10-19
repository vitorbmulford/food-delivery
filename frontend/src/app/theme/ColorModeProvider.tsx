import { useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { createAppTheme } from './theme'
import { ColorModeContext, type ColorMode } from './ColorModeContext'
const STORAGE_KEY = 'foody-color-mode'

function getInitialMode(): ColorMode {
  const savedMode = window.localStorage.getItem(STORAGE_KEY)
  if (savedMode === 'light' || savedMode === 'dark') return savedMode
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ColorModeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<ColorMode>(getInitialMode)
  const theme = useMemo(() => createAppTheme(mode), [mode])
  const contextValue = useMemo(
    () => ({
      mode,
      toggleMode: () => setMode((currentMode) => (currentMode === 'light' ? 'dark' : 'light')),
    }),
    [mode],
  )

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  return (
    <ColorModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}
