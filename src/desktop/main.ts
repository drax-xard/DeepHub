declare const __DEEPHUB_CLIENT__: string

type WebContents = {
  isDestroyed(): boolean
  executeJavaScript(code: string): Promise<unknown>
  on(event: "did-finish-load", listener: () => void): void
  removeListener(event: "did-finish-load", listener: () => void): void
}

type Window = {
  id: number
  webContents: WebContents
}

type Context = {
  windows: {
    list(): readonly Window[]
    on(event: "open" | "close", handler: (window: Window) => void): () => void
  }
  scope: {
    addFinalizer(fn: () => void): void
  }
}

const DISPOSE = "window.__deephubDispose?.(); delete window.__deephubDispose;"

export default function setup(ctx: Context) {
  const stops = new Map<number, () => void>()

  const execute = (window: Window, code: string) => {
    if (window.webContents.isDestroyed()) return
    void window.webContents.executeJavaScript(code).catch(() => undefined)
  }

  const attach = (window: Window) => {
    if (stops.has(window.id) || window.webContents.isDestroyed()) return

    const inject = () => execute(window, __DEEPHUB_CLIENT__)
    window.webContents.on("did-finish-load", inject)
    stops.set(window.id, () => {
      execute(window, DISPOSE)
      window.webContents.removeListener("did-finish-load", inject)
    })
    inject()
  }

  const detach = (window: Window) => {
    stops.get(window.id)?.()
    stops.delete(window.id)
  }

  for (const window of ctx.windows.list()) attach(window)

  const offOpen = ctx.windows.on("open", attach)
  const offClose = ctx.windows.on("close", detach)

  ctx.scope.addFinalizer(() => {
    offOpen()
    offClose()
    for (const [id, stop] of stops) {
      stop()
      stops.delete(id)
    }
  })
}
