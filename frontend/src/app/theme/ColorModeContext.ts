import { createContext, useContext } from 'react'

export type ColorMode = 'light' | 'dark'

type ColorModeContextValue = {
  mode: ColorMode
  toggleMode: () => void
}

export const ColorModeContext = createContext<ColorModeContextValue | null>(null)

export function useColorMode() {
  const context = useContext(ColorModeContext)
  if (!context) throw new Error('useColorMode deve ser usado dentro de ColorModeProvider.')
  return context
}
