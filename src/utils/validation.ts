import { httpError } from './httpError'

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function assertDateString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !DATE_REGEX.test(value)) {
    throw httpError(400, `${field} must be YYYY-MM-DD`)
  }
  return value
}

export function assertOneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw httpError(400, `${field} must be one of ${allowed.join(', ')}`)
  }
  return value as T
}

export function assertOptionalIntInRange(value: unknown, min: number, max: number, field: string): number | undefined {
  if (value === undefined || value === null) return undefined
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw httpError(400, `${field} must be an integer between ${min} and ${max}`)
  }
  return value as number
}

export function assertPositiveInt(value: unknown, field: string): number {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (!Number.isInteger(n) || n <= 0) {
    throw httpError(400, `${field} must be a positive integer`)
  }
  return n
}
