import assert from "node:assert/strict"
import test from "node:test"
import { Window } from "happy-dom"

test("desktop overlay mounts and cleans up", async () => {
  const browser = new Window({ url: "https://opencode.ai/" })

  Object.assign(globalThis, {
    window: browser,
    document: browser.document,
    localStorage: browser.localStorage,
    Node: browser.Node,
    MouseEvent: browser.MouseEvent,
    PointerEvent: browser.PointerEvent,
    requestAnimationFrame: browser.requestAnimationFrame.bind(browser),
  })

  await import("./client.ts")

  const root = browser.document.getElementById("deephub-indicator")
  assert.ok(root)
  assert.match(root.textContent ?? "", /PEAK/)

  const pill = root.querySelector("[data-role='pill']")
  const popup = root.querySelector("[data-role='popup']") as unknown as { hidden: boolean } | null
  const model = root.querySelector("[data-role='model']") as unknown as { textContent: string | null } | null
  assert.ok(pill)
  assert.ok(popup)
  assert.ok(model)
  assert.ok(browser.document.getElementById("deephub-indicator-style"))

  assert.equal(popup.hidden, true)
  pill.dispatchEvent(new browser.MouseEvent("mouseover", { bubbles: true, relatedTarget: browser.document.body }))
  assert.equal(popup.hidden, false)
  assert.match(model.textContent ?? "", /DeepSeek Flash/)

  pill.dispatchEvent(
    new browser.PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1, clientX: 10, clientY: 10 }),
  )
  pill.dispatchEvent(
    new browser.PointerEvent("pointerup", { bubbles: true, button: 0, pointerId: 1, clientX: 10, clientY: 10 }),
  )
  assert.match(model.textContent ?? "", /DeepSeek V4 Pro/)

  window.__deephubDispose?.()

  assert.equal(browser.document.getElementById("deephub-indicator"), null)
  assert.equal(browser.document.getElementById("deephub-indicator-style"), null)
})
