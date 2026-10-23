/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import {
  DEFAULT_HOLIDAYS,
  DEEPSEEK_MODELS,
  formatDuration,
  formatUSD,
  phaseInfo,
  ratesFor,
  resolveDeepSeekModel,
  type DeepSeekModelID,
} from "./deephub.ts"

type DeepHubOptions = {
  model: DeepSeekModelID | "auto"
  fallbackModel: DeepSeekModelID
  showCountdown: boolean
  cycleOnClick: boolean
  holidays: ReadonlySet<string>
}

const MODEL_CYCLE: DeepSeekModelID[] = ["deepseek-flash", "deepseek-v4-pro"]

function readOptions(options: Record<string, unknown> | undefined): DeepHubOptions {
  const configured =
    typeof options?.model === "string" ? resolveDeepSeekModel(options.model) : undefined
  const fallback =
    typeof options?.fallbackModel === "string"
      ? resolveDeepSeekModel(options.fallbackModel)
      : undefined

  const holidays = new Set<string>()
  if (options?.ignoreHolidays !== true) {
    for (const date of DEFAULT_HOLIDAYS) holidays.add(date)
  }
  if (Array.isArray(options?.holidays)) {
    for (const date of options.holidays) {
      if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) holidays.add(date)
    }
  }

  return {
    model: configured ?? "auto",
    fallbackModel: fallback ?? "deepseek-flash",
    showCountdown: options?.showCountdown !== false,
    cycleOnClick: options?.cycleOnClick !== false,
    holidays,
  }
}

function detectDeepSeekModel(api: TuiPluginApi): DeepSeekModelID | undefined {
  const route = api.route.current
  if (route.name === "session") {
    const sessionID = (route.params as { sessionID?: unknown } | undefined)?.sessionID
    const messages =
      typeof sessionID === "string" ? api.state.session.messages(sessionID) : []
    for (let index = messages.length - 1; index >= 0; index--) {
      const message = messages[index]
      if (!message) continue
      const providerID = message.role === "user" ? message.model.providerID : message.providerID
      if (providerID !== "deepseek") continue
      const modelID = message.role === "user" ? message.model.modelID : message.modelID
      const model = resolveDeepSeekModel(modelID)
      if (model) return model
    }
  }

  const configured = api.state.config.model
  if (typeof configured === "string") {
    const [providerID, modelID] = configured.split("/")
    if (providerID === "deepseek" && modelID) return resolveDeepSeekModel(modelID)
  }

  return undefined
}

function useNow() {
  const [now, setNow] = createSignal(Date.now())
  const timer = setInterval(() => setNow(Date.now()), 1000)
  onCleanup(() => clearInterval(timer))
  return now
}

function Indicator(props: { api: TuiPluginApi; options: DeepHubOptions }) {
  const theme = props.api.theme.current
  const now = useNow()
  const minute = createMemo(() => Math.floor(now() / 60000))
  const info = createMemo(() => phaseInfo(new Date(minute() * 60000), props.options.holidays))

  const stored = resolveDeepSeekModel(props.api.kv.get<string>("model"))
  const [manual, setManual] = createSignal<DeepSeekModelID | "auto">(
    props.options.model !== "auto" ? props.options.model : stored ?? "auto",
  )
  const [hovered, setHovered] = createSignal(false)

  let closeTimer: ReturnType<typeof setTimeout> | undefined
  const openHover = () => {
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = undefined
    }
    setHovered(true)
  }
  const closeHover = () => {
    if (closeTimer) clearTimeout(closeTimer)
    closeTimer = setTimeout(() => {
      setHovered(false)
      closeTimer = undefined
    }, 150)
  }
  onCleanup(() => {
    if (closeTimer) clearTimeout(closeTimer)
  })

  const model = createMemo<DeepSeekModelID>(() => {
    void minute()
    const selected = manual()
    if (selected !== "auto") return selected
    return detectDeepSeekModel(props.api) ?? props.options.fallbackModel
  })
  const pricing = createMemo(() => DEEPSEEK_MODELS[model()])
  const phase = createMemo(() => info().phase)
  const phaseColor = createMemo(() => (phase() === "peak" ? theme.warning : theme.success))
  const countdown = createMemo(() => formatDuration(info().nextChange.getTime() - now()))
  const rates = createMemo(() => ratesFor(model(), phase()))

  const rows = createMemo(() => [
    { label: "Cache hit", value: formatUSD(rates().cacheHit) },
    { label: "Cache miss", value: formatUSD(rates().cacheMiss) },
    { label: "Output", value: formatUSD(rates().output) },
  ])

  const cycle = () => {
    if (!props.options.cycleOnClick) return
    const index = MODEL_CYCLE.indexOf(model())
    const next = MODEL_CYCLE[(index + 1) % MODEL_CYCLE.length] ?? "deepseek-flash"
    setManual(next)
    props.api.kv.set("model", next)
  }

  return (
    <box position="relative">
      <box
        flexDirection="row"
        gap={1}
        onMouseOver={openHover}
        onMouseOut={closeHover}
        onMouseUp={cycle}
      >
        <text fg={phaseColor()}>●</text>
        <text fg={theme.textMuted}>{phase() === "peak" ? "PEAK" : "OFF-PEAK"}</text>
        <Show when={props.options.showCountdown}>
          <text fg={theme.textMuted}>{countdown()}</text>
        </Show>
      </box>

      <Show when={hovered()}>
        <box
          position="absolute"
          bottom={1}
          right={0}
          zIndex={1000}
          width={43}
          maxWidth="100%"
          flexDirection="column"
          backgroundColor={theme.backgroundPanel}
          border
          borderColor={theme.borderActive}
          paddingTop={1}
          paddingBottom={1}
          paddingLeft={1}
          paddingRight={1}
          onMouseOver={openHover}
          onMouseOut={closeHover}
        >
          <box flexDirection="row" justifyContent="space-between" gap={1}>
            <text fg={theme.text}>
              <b>{pricing().name}</b>
            </text>
            <text fg={phaseColor()}>{phase() === "peak" ? "PEAK" : "OFF-PEAK"}</text>
          </box>
          <text fg={theme.textMuted}>USD per 1M tokens</text>
          <box flexDirection="column" paddingTop={1}>
            <For each={rows()}>
              {(row) => (
                <box flexDirection="row" justifyContent="space-between">
                  <text fg={theme.textMuted}>{row.label}</text>
                  <text fg={theme.text}>{row.value}</text>
                </box>
              )}
            </For>
          </box>
          <text fg={theme.textMuted}>Next change in {countdown()}</text>
          <text fg={theme.textMuted}>{"Peak 01–04 & 06–10 UTC, Mon–Fri"}</text>
          <Show when={props.options.cycleOnClick}>
            <text fg={theme.textMuted}>Click the indicator to switch model</text>
          </Show>
        </box>
      </Show>
    </box>
  )
}

const tui: TuiPlugin = async (api, options) => {
  const config = readOptions(options)

  api.slots.register({
    order: 50,
    slots: {
      home_prompt_right() {
        return <Indicator api={api} options={config} />
      },
      session_prompt_right() {
        return <Indicator api={api} options={config} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: "deephub",
  tui,
}

export default plugin
