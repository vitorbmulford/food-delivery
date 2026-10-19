import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchAddressByCep } = vi.hoisted(() => ({ fetchAddressByCep: vi.fn() }))
vi.mock('../api/cepApi', () => ({
  fetchAddressByCep,
  CepLookupError: class CepLookupError extends Error {
    readonly kind: string
    constructor(kind: string) {
      super(kind)
      this.kind = kind
    }
  },
}))

import { useCepLookup } from './useCepLookup'

describe('useCepLookup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })
  afterEach(() => vi.useRealTimers())

  it('ignora a resposta do CEP anterior quando uma busca mais recente já começou', async () => {
    let resolveFirst!: (value: {
      street: string
      neighborhood: string
      city: string
      state: string
    }) => void
    let resolveSecond!: (value: {
      street: string
      neighborhood: string
      city: string
      state: string
    }) => void
    fetchAddressByCep
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve
          }),
      )
    const onAddressFound = vi.fn()
    const { rerender } = renderHook(({ cep }) => useCepLookup(cep, onAddressFound), {
      initialProps: { cep: '11111-111' },
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(fetchAddressByCep).toHaveBeenCalledTimes(1)
    rerender({ cep: '22222-222' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(fetchAddressByCep).toHaveBeenCalledTimes(2)

    await act(async () => {
      resolveFirst({
        street: 'Rua antiga',
        neighborhood: 'Antigo',
        city: 'Cidade antiga',
        state: 'AA',
      })
    })
    expect(onAddressFound).not.toHaveBeenCalled()
    await act(async () => {
      resolveSecond({ street: 'Rua nova', neighborhood: 'Novo', city: 'Cidade nova', state: 'SP' })
    })
    expect(onAddressFound).toHaveBeenCalledOnce()
    expect(onAddressFound).toHaveBeenCalledWith({
      street: 'Rua nova',
      neighborhood: 'Novo',
      city: 'Cidade nova',
      state: 'SP',
    })
  })
})
