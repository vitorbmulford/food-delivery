import { createTheme, alpha } from '@mui/material/styles'

const ink = '#172b24'
const green = '#1f6b4f'
const orange = '#e9944a'

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: green,
      dark: '#174d3a',
      light: '#e7f2ec',
      contrastText: '#fff',
    },
    secondary: {
      main: orange,
      dark: '#b86825',
      light: '#fff2e5',
      contrastText: ink,
    },
    background: { default: '#f5f7f5', paper: '#fff' },
    text: { primary: ink, secondary: '#68766f' },
    divider: '#e6ebe7',
    success: { main: '#36815f' },
    warning: { main: '#c87b31' },
    error: { main: '#bf5149' },
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
        body: { minWidth: 320, minHeight: '100vh' },
        a: { color: green },
        '::selection': { backgroundColor: alpha(green, 0.18) },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiButton: {
      styleOverrides: { root: { borderRadius: 10, minHeight: 40 } },
    },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10 } } },
  },
})
