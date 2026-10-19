export type CepAddress = {
  street: string
  neighborhood: string
  city: string
  state: string
}

export type CepLookupErrorKind = 'invalid' | 'not-found' | 'network' | 'timeout' | 'unavailable'

export class CepLookupError extends Error {
  readonly kind: CepLookupErrorKind

  constructor(kind: CepLookupErrorKind) {
    super(kind)
    this.name = 'CepLookupError'
    this.kind = kind
  }
}

type ViaCepResponse = {
  erro?: boolean | string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
}

export async function fetchAddressByCep(cep: string, signal?: AbortSignal): Promise<CepAddress> {
  const digits = cep.replace(/\D/g, '')
  if (!/^\d{8}$/.test(digits)) throw new CepLookupError('invalid')

  const controller = new AbortController()
  let timedOut = false
  const relayAbort = () => controller.abort()
  signal?.addEventListener('abort', relayAbort, { once: true })
  if (signal?.aborted) controller.abort()
  const timeout = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 8_000)

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new CepLookupError('unavailable')

    const data = (await response.json()) as ViaCepResponse
    if (data.erro === true || data.erro === 'true') throw new CepLookupError('not-found')
    if (
      typeof data.logradouro !== 'string' ||
      typeof data.bairro !== 'string' ||
      typeof data.localidade !== 'string' ||
      typeof data.uf !== 'string'
    ) {
      throw new CepLookupError('unavailable')
    }

    return {
      street: data.logradouro,
      neighborhood: data.bairro,
      city: data.localidade,
      state: data.uf,
    }
  } catch (error) {
    if (error instanceof CepLookupError) throw error
    if (signal?.aborted) throw error
    if (timedOut) throw new CepLookupError('timeout')
    if (controller.signal.aborted) throw new CepLookupError('timeout')
    throw new CepLookupError('network')
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', relayAbort)
  }
}
