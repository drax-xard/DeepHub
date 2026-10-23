import {
  DEEPSEEK_MODELS,
  formatDuration,
  formatUSD,
  phaseInfo,
  ratesFor,
  resolveDeepSeekModel,
  type DeepSeekModelID,
} from "../deephub.ts"

const ROOT_ID = "deephub-indicator"
const STYLE_ID = "deephub-indicator-style"
const MODEL_KEY = "deephub.desktop.model"
const POSITION_KEY = "deephub.desktop.position"
const MODELS: DeepSeekModelID[] = ["deepseek-flash", "deepseek-v4-pro"]

declare global {
  interface Window {
    __deephubDispose?: () => void
  }
}

const css = `
#${ROOT_ID} {
  --dh-bg: rgba(24, 24, 27, 0.94);
  --dh-popup: rgba(24, 24, 27, 0.98);
  --dh-fg: #f4f4f5;
  --dh-muted: #a1a1aa;
  --dh-border: rgba(255, 255, 255, 0.14);
  --dh-hover: rgba(255, 255, 255, 0.08);
  --dh-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483647;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 11px;
  line-height: 1;
  color: var(--dh-fg);
  pointer-events: none;
}
@media (prefers-color-scheme: light) {
  #${ROOT_ID} {
    --dh-bg: rgba(255, 255, 255, 0.96);
    --dh-popup: rgba(255, 255, 255, 0.99);
    --dh-fg: #18181b;
    --dh-muted: #52525b;
    --dh-border: rgba(0, 0, 0, 0.12);
    --dh-hover: rgba(0, 0, 0, 0.05);
    --dh-shadow: 0 10px 28px rgba(0, 0, 0, 0.14);
  }
}
#${ROOT_ID} .dh-pill {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border: 1px solid var(--dh-border);
  border-radius: 999px;
  background: var(--dh-bg);
  box-shadow: var(--dh-shadow);
  cursor: grab;
  user-select: none;
  white-space: nowrap;
}
#${ROOT_ID} .dh-pill:active {
  cursor: grabbing;
}
#${ROOT_ID} .dh-pill:hover {
  filter: brightness(1.08);
}
#${ROOT_ID} .dh-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.14);
  flex: none;
}
#${ROOT_ID} .dh-label {
  font-weight: 600;
  letter-spacing: 0.02em;
}
#${ROOT_ID} .dh-countdown {
  color: var(--dh-muted);
}
#${ROOT_ID} .dh-popup {
  pointer-events: auto;
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  width: 246px;
  padding: 10px 11px;
  border: 1px solid var(--dh-border);
  border-radius: 10px;
  background: var(--dh-popup);
  box-shadow: var(--dh-shadow);
  display: flex;
  flex-direction: column;
  gap: 7px;
}
#${ROOT_ID} .dh-popup[hidden] {
  display: none;
}
#${ROOT_ID} .dh-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
}
#${ROOT_ID} .dh-phase {
  font-size: 10px;
}
#${ROOT_ID} .dh-sub {
  color: var(--dh-muted);
  font-size: 10px;
}
#${ROOT_ID} .dh-rows {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 2px 0;
}
#${ROOT_ID} .dh-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
#${ROOT_ID} .dh-row span:first-child {
  color: var(--dh-muted);
}
#${ROOT_ID} .dh-row span:last-child {
  font-variant-numeric: tabular-nums;
}
#${ROOT_ID} .dh-foot {
  color: var(--dh-muted);
  font-size: 10px;
}
`

function restoreModel(): DeepSeekModelID {
  try {
    return resolveDeepSeekModel(localStorage.getItem(MODEL_KEY) ?? undefined) ?? "deepseek-flash"
  } catch {
    return "deepseek-flash"
  }
}

function readPosition(): { left: number; top: number } | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(POSITION_KEY) ?? "null")
    if (typeof value?.left !== "number" || typeof value?.top !== "number") return undefined
    return { left: value.left, top: value.top }
  } catch {
    return undefined
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}

export function start() {
  const root = document.createElement("div")
  root.id = ROOT_ID
  root.innerHTML = `
    <div class="dh-pill" data-role="pill">
      <span class="dh-dot" data-role="dot"></span>
      <span class="dh-label" data-role="label"></span>
      <span class="dh-countdown" data-role="countdown"></span>
    </div>
    <div class="dh-popup" data-role="popup" hidden>
      <div class="dh-head">
        <span data-role="model"></span>
        <span class="dh-phase" data-role="phase"></span>
      </div>
      <div class="dh-sub">USD per 1M tokens</div>
      <div class="dh-rows">
        <div class="dh-row"><span>Cache hit</span><span data-role="hit"></span></div>
        <div class="dh-row"><span>Cache miss</span><span data-role="miss"></span></div>
        <div class="dh-row"><span>Output</span><span data-role="output"></span></div>
      </div>
      <div class="dh-foot" data-role="next"></div>
      <div class="dh-foot">Peak 01–04 &amp; 06–10 UTC, Mon–Fri</div>
      <div class="dh-foot">Click to switch model · Drag to move</div>
    </div>
  `

  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = css
  document.head.appendChild(style)
  document.body.appendChild(root)

  const pick = <ElementType extends Element>(role: string) =>
    root.querySelector<ElementType>(`[data-role="${role}"]`)

  const pill = pick<HTMLDivElement>("pill")
  const dot = pick<HTMLSpanElement>("dot")
  const label = pick<HTMLSpanElement>("label")
  const countdown = pick<HTMLSpanElement>("countdown")
  const popup = pick<HTMLDivElement>("popup")
  const modelName = pick<HTMLSpanElement>("model")
  const phaseName = pick<HTMLSpanElement>("phase")
  const hit = pick<HTMLSpanElement>("hit")
  const miss = pick<HTMLSpanElement>("miss")
  const output = pick<HTMLSpanElement>("output")
  const next = pick<HTMLDivElement>("next")

  if (!pill || !dot || !label || !countdown || !popup || !modelName || !phaseName || !hit || !miss || !output || !next) {
    style.remove()
    root.remove()
    return () => {}
  }

  let model = restoreModel()
  let lastMinute = -1
  let info = phaseInfo(new Date())
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let drag:
    | {
        pointer: number
        startX: number
        startY: number
        left: number
        top: number
        moved: boolean
      }
    | undefined

  const setPosition = (left: number, top: number) => {
    root.style.right = "auto"
    root.style.bottom = "auto"
    root.style.left = `${clamp(left, 8, window.innerWidth - root.offsetWidth - 8)}px`
    root.style.top = `${clamp(top, 8, window.innerHeight - root.offsetHeight - 8)}px`
  }

  const savePosition = () => {
    try {
      localStorage.setItem(
        POSITION_KEY,
        JSON.stringify({ left: root.getBoundingClientRect().left, top: root.getBoundingClientRect().top }),
      )
    } catch {}
  }

  const positionPopup = () => {
    popup.style.left = "auto"
    popup.style.right = "0"
    popup.style.top = "auto"
    popup.style.bottom = "calc(100% + 8px)"

    requestAnimationFrame(() => {
      if (popup.hidden) return
      const rect = popup.getBoundingClientRect()
      if (rect.top < 8) {
        popup.style.bottom = "auto"
        popup.style.top = "calc(100% + 8px)"
      }
      if (rect.left < 8) {
        popup.style.right = "auto"
        popup.style.left = "0"
      }
      if (rect.right > window.innerWidth - 8) {
        popup.style.left = "auto"
        popup.style.right = "0"
      }
    })
  }

  const showPopup = () => {
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = undefined
    popup.hidden = false
    positionPopup()
  }

  const hidePopup = () => {
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      popup.hidden = true
      hideTimer = undefined
    }, 160)
  }

  const render = () => {
    const now = Date.now()
    const minute = Math.floor(now / 60000)
    if (minute !== lastMinute) {
      lastMinute = minute
      info = phaseInfo(new Date(minute * 60000))
    }

    const phase = info.phase
    const rates = ratesFor(model, phase)
    const phaseLabel = phase === "peak" ? "PEAK" : "OFF-PEAK"
    const phaseColor = phase === "peak" ? "#f59e0b" : "#22c55e"
    const remaining = formatDuration(info.nextChange.getTime() - now)

    dot.style.background = phaseColor
    dot.style.boxShadow = `0 0 0 3px ${phase === "peak" ? "rgba(245, 158, 11, 0.16)" : "rgba(34, 197, 94, 0.14)"}`
    label.textContent = phaseLabel
    countdown.textContent = remaining
    modelName.textContent = DEEPSEEK_MODELS[model].name
    phaseName.textContent = phaseLabel
    phaseName.style.color = phaseColor
    hit.textContent = formatUSD(rates.cacheHit)
    miss.textContent = formatUSD(rates.cacheMiss)
    output.textContent = formatUSD(rates.output)
    next.textContent = `Next change in ${remaining}`
  }

  const cycle = () => {
    const index = MODELS.indexOf(model)
    model = MODELS[(index + 1) % MODELS.length] ?? "deepseek-flash"
    try {
      localStorage.setItem(MODEL_KEY, model)
    } catch {}
    render()
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    const rect = root.getBoundingClientRect()
    drag = {
      pointer: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
    }
    try {
      pill.setPointerCapture(event.pointerId)
    } catch {}
    event.preventDefault()
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!drag || drag.pointer !== event.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) < 4) return
    drag.moved = true
    setPosition(drag.left + dx, drag.top + dy)
  }

  const onPointerUp = (event: PointerEvent) => {
    if (!drag || drag.pointer !== event.pointerId) return
    const moved = drag.moved
    drag = undefined
    try {
      pill.releasePointerCapture(event.pointerId)
    } catch {}
    if (!moved) {
      cycle()
      return
    }
    savePosition()
    popup.hidden = true
  }

  const onPointerCancel = () => {
    drag = undefined
  }

  const onResize = () => {
    if (root.style.left) setPosition(root.getBoundingClientRect().left, root.getBoundingClientRect().top)
  }

  const onMouseOver = (event: MouseEvent) => {
    if (event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return
    showPopup()
  }
  const onMouseOut = (event: MouseEvent) => {
    if (event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return
    hidePopup()
  }

  root.addEventListener("mouseover", onMouseOver)
  root.addEventListener("mouseout", onMouseOut)
  pill.addEventListener("pointerdown", onPointerDown)
  pill.addEventListener("pointermove", onPointerMove)
  pill.addEventListener("pointerup", onPointerUp)
  pill.addEventListener("pointercancel", onPointerCancel)
  window.addEventListener("resize", onResize)

  const saved = readPosition()
  if (saved) setPosition(saved.left, saved.top)
  render()
  const timer = setInterval(render, 1000)

  return () => {
    clearInterval(timer)
    if (hideTimer) clearTimeout(hideTimer)
    root.removeEventListener("mouseover", onMouseOver)
    root.removeEventListener("mouseout", onMouseOut)
    window.removeEventListener("resize", onResize)
    root.remove()
    style.remove()
  }
}

const previous = window.__deephubDispose
if (previous) previous()
delete window.__deephubDispose

let cleanup: (() => void) | undefined
const onReady = () => {
  cleanup = start()
}
const dispose = () => {
  window.removeEventListener("DOMContentLoaded", onReady)
  cleanup?.()
  cleanup = undefined
  delete window.__deephubDispose
}

window.__deephubDispose = dispose

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", onReady, { once: true })
} else {
  onReady()
}
