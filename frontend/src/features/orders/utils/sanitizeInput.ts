import type { ChangeEvent } from 'react'
import type { ChangeHandler } from 'react-hook-form'

export function getCharacterLimitWarning(value: string | undefined, maxLength: number) {
  return value?.length === maxLength
    ? `Limite máximo de ${maxLength} caracteres atingido.`
    : undefined
}

export function getPriceLimitWarning(value: string | undefined) {
  const integerDigits = value?.split(/[.,]/, 1)[0]?.length ?? 0
  return integerDigits === 14
    ? 'Limite de 14 dígitos inteiros atingido. Ainda é possível informar até 2 casas decimais.'
    : undefined
}

/** Converts typed or pasted currency text to the value expected by the order form. */
export function normalizeCurrencyInput(value: string) {
  const cleaned = value.replace(/[^\d,]/g, '')
  const [integerPart = '', ...decimalParts] = cleaned.split(',')
  const integerDigits = integerPart.slice(0, 14)
  const decimalDigits = decimalParts.join('').slice(0, 2)

  return cleaned.includes(',') ? `${integerDigits || '0'},${decimalDigits}` : integerDigits
}

/** Formats a normalized price for Brazilian currency entry without changing its form value. */
export function formatCurrencyInput(value: string) {
  if (!value) return ''

  const [integerPart, decimalPart] = value.split(',')
  const formattedInteger = (integerPart || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decimalPart === undefined ? formattedInteger : `${formattedInteger},${decimalPart}`
}

/** Keep only characters that leave the value valid while the user is typing. */
export function sanitizeInput(
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  onChange: ChangeHandler,
  pattern: RegExp,
  maxLength: number,
) {
  let value = ''
  for (const character of event.target.value) {
    const candidate = value + character
    if (candidate.length <= maxLength && pattern.test(candidate)) value = candidate
  }
  event.target.value = value
  void onChange(event)
}
