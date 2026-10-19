import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAddressByCep } from './cepApi'

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response
}

describe('consulta ViaCEP', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('consulta CEP sem máscara e converte a resposta para o formato do formulário', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        cep: '01001-000',
        logradouro: 'Praça da Sé',
        bairro: 'Sé',
        localidade: 'São Paulo',
        uf: 'SP',
      }),
    )

    await expect(fetchAddressByCep('01001-000')).resolves.toEqual({
      street: 'Praça da Sé',
      neighborhood: 'Sé',
      city: 'São Paulo',
      state: 'SP',
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://viacep.com.br/ws/01001000/json/',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('trata CEP não encontrado', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ erro: true }))
    await expect(fetchAddressByCep('99999-999')).rejects.toMatchObject({ kind: 'not-found' })
  })

  it('trata falha de rede sem expor detalhes', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('network internals'))
    await expect(fetchAddressByCep('01001000')).rejects.toMatchObject({ kind: 'network' })
  })

  it('interrompe a consulta após oito segundos', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )

    const pending = fetchAddressByCep('01001000')
    const assertion = expect(pending).rejects.toMatchObject({ kind: 'timeout' })
    await vi.advanceTimersByTimeAsync(8_000)
    await assertion
  })
})
