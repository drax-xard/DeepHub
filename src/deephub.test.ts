import assert from "node:assert/strict"
import test from "node:test"
import {
  DEEPSEEK_MODELS,
  DEFAULT_HOLIDAYS,
  chinaDateKey,
  formatDuration,
  formatUSD,
  nextPhaseChange,
  phaseAt,
  ratesFor,
  resolveDeepSeekModel,
} from "./deephub.ts"

const utc = (value: string) => new Date(`${value}Z`)

test("peak windows follow the DeepSeek UTC schedule", () => {
  assert.equal(phaseAt(utc("2026-10-23T00:59:00")), "off-peak")
  assert.equal(phaseAt(utc("2026-10-23T01:00:00")), "peak")
  assert.equal(phaseAt(utc("2026-10-23T03:59:00")), "peak")
  assert.equal(phaseAt(utc("2026-10-23T04:00:00")), "off-peak")
  assert.equal(phaseAt(utc("2026-10-23T06:00:00")), "peak")
  assert.equal(phaseAt(utc("2026-10-23T09:59:00")), "peak")
  assert.equal(phaseAt(utc("2026-10-23T10:00:00")), "off-peak")
})

test("weekends are always off-peak", () => {
  assert.equal(phaseAt(utc("2026-10-24T02:00:00")), "off-peak")
  assert.equal(phaseAt(utc("2026-10-25T07:00:00")), "off-peak")
})

test("Chinese public holidays are off-peak for the whole Beijing date", () => {
  assert.equal(chinaDateKey(utc("2026-10-04T16:00:00")), "2026-10-05")
  assert.equal(phaseAt(utc("2026-10-05T02:00:00")), "off-peak")
  assert.equal(phaseAt(utc("2026-10-08T02:00:00")), "peak")
  assert.equal(DEFAULT_HOLIDAYS.has("2026-10-05"), true)
})

test("next change is the next phase boundary", () => {
  assert.equal(
    nextPhaseChange(utc("2026-10-23T02:00:00")).toISOString(),
    "2026-10-23T04:00:00.000Z",
  )
  assert.equal(
    nextPhaseChange(utc("2026-10-23T04:00:00")).toISOString(),
    "2026-10-23T06:00:00.000Z",
  )
  assert.equal(
    nextPhaseChange(utc("2026-10-23T10:00:00")).toISOString(),
    "2026-10-26T01:00:00.000Z",
  )
  assert.equal(
    nextPhaseChange(utc("2026-10-05T02:00:00")).toISOString(),
    "2026-10-08T01:00:00.000Z",
  )
})

test("DeepSeek model pricing matches the published rates", () => {
  assert.deepEqual(ratesFor("deepseek-flash", "off-peak"), {
    cacheHit: 0.003,
    cacheMiss: 0.15,
    output: 0.6,
  })
  assert.deepEqual(ratesFor("deepseek-flash", "peak"), {
    cacheHit: 0.006,
    cacheMiss: 0.3,
    output: 1.2,
  })
  assert.deepEqual(ratesFor("deepseek-v4-pro", "off-peak"), {
    cacheHit: 0.022,
    cacheMiss: 0.66,
    output: 1.98,
  })
  assert.deepEqual(ratesFor("deepseek-v4-pro", "peak"), {
    cacheHit: 0.044,
    cacheMiss: 1.32,
    output: 3.96,
  })
  assert.equal(Object.keys(DEEPSEEK_MODELS).length, 2)
})

test("legacy and current model names resolve", () => {
  assert.equal(resolveDeepSeekModel("deepseek-flash"), "deepseek-flash")
  assert.equal(resolveDeepSeekModel("deepseek-v4-pro"), "deepseek-v4-pro")
  assert.equal(resolveDeepSeekModel("deepseek-v4-flash"), "deepseek-flash")
  assert.equal(resolveDeepSeekModel("deepseek-v4-flash-vision-exp"), "deepseek-flash")
  assert.equal(resolveDeepSeekModel("deepseek-chat"), undefined)
})

test("formatters stay compact", () => {
  assert.equal(formatUSD(0.003), "$0.003")
  assert.equal(formatUSD(0.022), "$0.022")
  assert.equal(formatUSD(0.15), "$0.15")
  assert.equal(formatUSD(0.3), "$0.3")
  assert.equal(formatUSD(1.2), "$1.2")
  assert.equal(formatDuration(30_000), "1m")
  assert.equal(formatDuration(2 * 60 * 60 * 1000 + 5 * 60 * 1000), "2h 05m")
  assert.equal(formatDuration(26 * 60 * 60 * 1000), "1d 2h")
})
