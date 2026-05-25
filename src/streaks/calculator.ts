export interface StreakResult {
  current: number
  longest: number
  startDate: string | null
  lastCheckIn: string | null
}

const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/

function shiftDay(dateString: string, delta: number): string {
  const match = DATE_REGEX.exec(dateString)
  if (!match) return dateString
  const [, y, m, d] = match
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  date.setUTCDate(date.getUTCDate() + delta)
  const yyyy = date.getUTCFullYear().toString().padStart(4, '0')
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  const dd = date.getUTCDate().toString().padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function prevDay(dateString: string): string {
  return shiftDay(dateString, -1)
}

export function nextDay(dateString: string): string {
  return shiftDay(dateString, 1)
}

export function parseTz(input: unknown): string | null {
  if (typeof input !== 'string' || input.length === 0) return null
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: input })
    return input
  } catch {
    return null
  }
}

export function computeStreaks(dateStrings: string[], today: string): StreakResult {
  const set = new Set(dateStrings)
  const sorted = [...set].sort()

  let day = set.has(today) ? today : prevDay(today)
  let current = 0
  let startDate: string | null = null
  while (set.has(day)) {
    current += 1
    startDate = day
    day = prevDay(day)
  }

  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const d of sorted) {
    run = prev && nextDay(prev) === d ? run + 1 : 1
    if (run > longest) longest = run
    prev = d
  }

  return {
    current,
    longest,
    startDate,
    lastCheckIn: sorted.length > 0 ? sorted[sorted.length - 1] : null,
  }
}
