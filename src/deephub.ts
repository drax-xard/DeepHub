export type Phase = "peak" | "off-peak"

export type Rate = {
  offPeak: number
  peak: number
}

export type DeepSeekModelID = "deepseek-flash" | "deepseek-v4-pro"

export type DeepSeekModel = {
  id: DeepSeekModelID
  name: string
  cacheHit: Rate
  cacheMiss: Rate
  output: Rate
}

export type ModelRates = {
  cacheHit: number
  cacheMiss: number
  output: number
}

export type PhaseInfo = {
  phase: Phase
  nextChange: Date
}

export const DEEPSEEK_MODELS: Record<DeepSeekModelID, DeepSeekModel> = {
  "deepseek-flash": {
    id: "deepseek-flash",
    name: "DeepSeek Flash",
    cacheHit: { offPeak: 0.003, peak: 0.006 },
    cacheMiss: { offPeak: 0.15, peak: 0.3 },
    output: { offPeak: 0.6, peak: 1.2 },
  },
  "deepseek-v4-pro": {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    cacheHit: { offPeak: 0.022, peak: 0.044 },
    cacheMiss: { offPeak: 0.66, peak: 1.32 },
    output: { offPeak: 1.98, peak: 3.96 },
  },
}

const LEGACY_MODEL_IDS: Record<string, DeepSeekModelID> = {
  "deepseek-v4-flash": "deepseek-flash",
  "deepseek-v4-flash-vision-exp": "deepseek-flash",
}

export function resolveDeepSeekModel(id: string | undefined): DeepSeekModelID | undefined {
  if (!id) return undefined
  const normalized = id.trim().toLowerCase()
  if (normalized in DEEPSEEK_MODELS) return normalized as DeepSeekModelID
  return LEGACY_MODEL_IDS[normalized]
}

export function ratesFor(model: DeepSeekModelID, phase: Phase): ModelRates {
  const pricing = DEEPSEEK_MODELS[model]
  const key = phase === "peak" ? "peak" : "offPeak"
  return {
    cacheHit: pricing.cacheHit[key],
    cacheMiss: pricing.cacheMiss[key],
    output: pricing.output[key],
  }
}

export function formatUSD(value: number): string {
  return `$${value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}`
}

const CST_OFFSET_MS = 8 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

export function chinaDateKey(date: Date): string {
  const shifted = new Date(date.getTime() + CST_OFFSET_MS)
  const year = shifted.getUTCFullYear()
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0")
  const day = String(shifted.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

const span = (year: number, month: number, start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => iso(year, month, start + index))

const HOLIDAYS_2025 = [
  iso(2025, 1, 1),
  ...span(2025, 1, 28, 31),
  ...span(2025, 2, 1, 4),
  ...span(2025, 4, 4, 6),
  ...span(2025, 5, 1, 5),
  ...span(2025, 5, 31, 31),
  ...span(2025, 6, 1, 2),
  ...span(2025, 10, 1, 8),
]

const HOLIDAYS_2026 = [
  ...span(2026, 1, 1, 3),
  ...span(2026, 2, 15, 23),
  ...span(2026, 4, 4, 6),
  ...span(2026, 5, 1, 5),
  ...span(2026, 6, 19, 21),
  ...span(2026, 9, 25, 27),
  ...span(2026, 10, 1, 7),
]

const HOLIDAYS_2027 = [
  iso(2027, 1, 1),
  ...span(2027, 2, 5, 11),
  iso(2027, 4, 5),
  iso(2027, 5, 1),
  iso(2027, 6, 9),
  iso(2027, 9, 15),
  ...span(2027, 10, 1, 6),
]

export const DEFAULT_HOLIDAYS: ReadonlySet<string> = new Set([
  ...HOLIDAYS_2025,
  ...HOLIDAYS_2026,
  ...HOLIDAYS_2027,
])

export function isChineseHoliday(
  date: Date,
  holidays: ReadonlySet<string> = DEFAULT_HOLIDAYS,
): boolean {
  return holidays.has(chinaDateKey(date))
}

export function phaseAt(date: Date, holidays: ReadonlySet<string> = DEFAULT_HOLIDAYS): Phase {
  if (isChineseHoliday(date, holidays)) return "off-peak"

  const weekday = date.getUTCDay()
  if (weekday === 0 || weekday === 6) return "off-peak"

  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes()
  const peak = (minutes >= 60 && minutes < 240) || (minutes >= 360 && minutes < 600)
  return peak ? "peak" : "off-peak"
}

export function nextPhaseChange(
  date: Date,
  holidays: ReadonlySet<string> = DEFAULT_HOLIDAYS,
): Date {
  const phase = phaseAt(date, holidays)
  const limit = date.getTime() + 32 * 24 * HOUR_MS
  let cursor = Math.floor(date.getTime() / HOUR_MS) * HOUR_MS + HOUR_MS

  while (cursor <= limit) {
    if (phaseAt(new Date(cursor), holidays) !== phase) return new Date(cursor)
    cursor += HOUR_MS
  }

  return new Date(limit)
}

export function phaseInfo(
  date: Date,
  holidays: ReadonlySet<string> = DEFAULT_HOLIDAYS,
): PhaseInfo {
  return {
    phase: phaseAt(date, holidays),
    nextChange: nextPhaseChange(date, holidays),
  }
}

export function formatDuration(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / MINUTE_MS))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`
  return `${minutes}m`
}
