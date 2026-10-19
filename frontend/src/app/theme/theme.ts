import { createTheme, alpha, type PaletteMode } from '@mui/material/styles'

const ink = '#241b1b'
const brandRed = '#ff5c5c'
const brandRedDark = '#d40101'

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark'
  const accent = isDark ? brandRed : brandRedDark

  return createTheme({
    palette: {
      mode,
      primary: {
        main: brandRed,
        dark: accent,
        light: isDark ? alpha(brandRed, 0.16) : '#fff0f0',
        contrastText: ink,
      },
      secondary: {
        main: brandRed,
        dark: accent,
        light: isDark ? alpha(brandRed, 0.16) : '#fff0f0',
        contrastText: ink,
      },
      background: {
        default: isDark ? '#181a1b' : '#f8f6f6',
        paper: isDark ? '#232629' : '#fff',
      },
      text: { primary: isDark ? '#f1f3f4' : ink, secondary: isDark ? '#b0b6ba' : '#75696a' },
      divider: isDark ? '#3b4044' : '#eee5e5',
      success: { main: brandRedDark },
      warning: { main: '#c87b31' },
      error: { main: brandRedDark },
    },
    typography: {
      fontFamily: 'Roboto, Arial, sans-serif',
      h1: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.04em' },
      h2: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.025em' },
      h3: { fontSize: '1.125rem', fontWeight: 700 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    spacing: 8,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { minWidth: 320, minHeight: '100vh', colorScheme: mode },
          a: { color: accent },
          '::selection': { backgroundColor: alpha(brandRed, 0.2) },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiButton: {
        styleOverrides: { root: { borderRadius: 10, minHeight: 40 } },
      },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10 } } },
    },
  })
}

export const appTheme = createAppTheme('light')
