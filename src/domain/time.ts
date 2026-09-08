/** Small, dependency-free UTC helpers shared by browser and Lambda code. */

export function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return value
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${String(value)}`)
  return d
}

export function toIso(value: Date | string | number): string {
  return toDate(value).toISOString()
}

export function isBefore(a: Date | string, b: Date | string): boolean {
  return toDate(a).getTime() < toDate(b).getTime()
}

export function isSameOrAfter(a: Date | string, b: Date | string): boolean {
  return toDate(a).getTime() >= toDate(b).getTime()
}

export function addHours(value: Date | string, hours: number): Date {
  return new Date(toDate(value).getTime() + hours * 3_600_000)
}

export function addDays(value: Date | string, days: number): Date {
  return addHours(value, days * 24)
}

export function minDate(values: Array<Date | string>): Date | null {
  if (values.length === 0) return null
  return new Date(Math.min(...values.map((v) => toDate(v).getTime())))
}

export function maxDate(values: Array<Date | string>): Date | null {
  if (values.length === 0) return null
  return new Date(Math.max(...values.map((v) => toDate(v).getTime())))
}
