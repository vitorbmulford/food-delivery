let accessToken: string | null = null
export const currentUserQueryKey = ['auth', 'me'] as const
const EXPLICIT_LOGOUT_KEY = 'foody-explicit-logout'

export function getAccessToken() {
  return accessToken
}

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function hasExplicitLogoutMarker() {
  return (
    typeof window !== 'undefined' && window.localStorage.getItem(EXPLICIT_LOGOUT_KEY) === 'true'
  )
}

export function setExplicitLogoutMarker(isLoggedOut: boolean) {
  if (typeof window === 'undefined') return
  if (isLoggedOut) window.localStorage.setItem(EXPLICIT_LOGOUT_KEY, 'true')
  else window.localStorage.removeItem(EXPLICIT_LOGOUT_KEY)
}

export function notifySessionExpired() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('foody:session-expired'))
  }
}
