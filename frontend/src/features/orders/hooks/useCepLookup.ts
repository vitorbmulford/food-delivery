import { useEffect, useRef, useState } from 'react'
import { CepLookupError, fetchAddressByCep, type CepAddress } from '../api/cepApi'

export type CepLookupState = 'idle' | 'loading' | 'success' | 'not-found' | 'error'

const debounceMs = 500

export function useCepLookup(postalCode: string, onAddressFound: (address: CepAddress) => void) {
  const [lookup, setLookup] = useState<{ cep: string; state: CepLookupState }>({
    cep: '',
    state: 'idle',
  })
  const [attempt, setAttempt] = useState(0)
  const sequence = useRef(0)
  const lastRequested = useRef('')
  const callbackRef = useRef(onAddressFound)

  useEffect(() => {
    callbackRef.current = onAddressFound
  }, [onAddressFound])

  useEffect(() => {
    const digits = postalCode.replace(/\D/g, '')
    if (!/^\d{8}$/.test(digits)) {
      sequence.current += 1
      lastRequested.current = ''
      return
    }
    if (lastRequested.current === digits) return

    const requestId = ++sequence.current
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      lastRequested.current = digits
      setLookup({ cep: digits, state: 'loading' })
      fetchAddressByCep(digits, controller.signal)
        .then((address) => {
          if (requestId !== sequence.current || controller.signal.aborted) return
          callbackRef.current(address)
          setLookup({ cep: digits, state: 'success' })
        })
        .catch((error: unknown) => {
          if (requestId !== sequence.current || controller.signal.aborted) return
          setLookup({
            cep: digits,
            state:
              error instanceof CepLookupError && error.kind === 'not-found' ? 'not-found' : 'error',
          })
        })
    }, debounceMs)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [postalCode, attempt])

  return {
    state:
      /^\d{8}$/.test(postalCode.replace(/\D/g, '')) && lookup.cep === postalCode.replace(/\D/g, '')
        ? lookup.state
        : 'idle',
    retry: () => {
      lastRequested.current = ''
      setLookup({ cep: postalCode.replace(/\D/g, ''), state: 'idle' })
      setAttempt((value) => value + 1)
    },
  }
}
