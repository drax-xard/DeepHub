# DeepHub

A DeepSeek pricing indicator for the OpenCode TUI and OpenCode Desktop.

- Shows `● PEAK` or `● OFF-PEAK` in the prompt footer, with an optional countdown to the next change.
- Hover the indicator to see the current DeepSeek rates for the selected model.
- Click the indicator to cycle between `deepseek-flash` and `deepseek-v4-pro`.

## Requirements

- OpenCode `1.18` or newer with TUI plugin support.
- `@opencode-ai/plugin` available in your OpenCode config directory. OpenCode installs this automatically when `tui.json` contains plugin entries.

## Install

TUI plugins are configured in `tui.json`, not `opencode.json`. There is no automatic directory discovery for TUI plugins.

First, install the plugin's own dependencies:

```sh
cd /absolute/path/to/DeepHub
npm install
```

Then add DeepHub to `~/.config/opencode/tui.json` (or `.opencode/tui.json` in a project):

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "file:///absolute/path/to/DeepHub/src/tui.tsx",
      {
        "model": "auto",
        "showCountdown": true
      }
    ]
  ]
}
```

Restart OpenCode. The indicator appears on the right side of the home and session prompts.

This repository also includes `.opencode/tui.json`, so running OpenCode from this checkout loads DeepHub directly.

A plain string entry also works when you do not need options:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["file:///absolute/path/to/DeepHub/src/tui.tsx"]
}
```

For an npm install, publish this package and add `"opencode-deephub"` to the `plugin` array. The package exposes its TUI entry at `./tui`.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `model` | `"auto"` | `"auto"`, `"deepseek-flash"`, or `"deepseek-v4-pro"`. Legacy `deepseek-v4-flash` names are accepted. |
| `fallbackModel` | `"deepseek-flash"` | Model shown when `model` is `"auto"` and no DeepSeek model is detected. |
| `showCountdown` | `true` | Show the time until the next peak/off-peak change. |
| `cycleOnClick` | `true` | Click the indicator to switch between the two current models. |
| `ignoreHolidays` | `false` | Ignore the built-in Chinese public holiday calendar. |
| `holidays` | `[]` | Extra dates in `YYYY-MM-DD` format to treat as Chinese public holidays. |

With `model: "auto"`, DeepHub reads the current session's latest DeepSeek message, then falls back to the `model` configured in OpenCode. A manual model choice made by clicking is persisted in OpenCode's plugin key-value store.

## Peak hours

DeepSeek applies peak rates during:

- `01:00–04:00 UTC`
- `06:00–10:00 UTC`

Peak days are Monday through Friday, excluding Chinese public holidays. All other hours are off-peak, including weekends and Chinese public holidays. Off-peak rates are half of peak rates.

The built-in holiday calendar covers 2025 through 2027. Update the calendar in `src/deephub.ts` when new dates are announced, or pass extra dates through the `holidays` option.

## Current rates

Prices are in USD per 1M tokens, from the [DeepSeek API pricing page](https://api-docs.deepseek.com/quick_start/pricing/) (retrieved 2026-10-23).

| Model | Cache hit (off-peak / peak) | Cache miss (off-peak / peak) | Output (off-peak / peak) |
| --- | --- | --- | --- |
| `deepseek-flash` | $0.003 / $0.006 | $0.15 / $0.3 | $0.6 / $1.2 |
| `deepseek-v4-pro` | $0.022 / $0.044 | $0.66 / $1.32 | $1.98 / $3.96 |

If DeepSeek changes its prices, update `DEEPSEEK_MODELS` in `src/deephub.ts`.

## OpenCode Desktop GUI

DeepHub also includes a Desktop overlay. It adds a draggable pill to every Desktop window with the same PEAK/OFF-PEAK state and countdown, and a hover popup with the current rates. Click the pill to switch models, or drag it to move it. The chosen model and position are remembered.

Build the Desktop bundles:

```sh
npm run build:desktop
```

This writes:

- `dist/deephub-0.2.0.ocdx` — the OpenCode GUI extension archive.
- `dist/deephub-overlay.js` — the standalone overlay script.

### Installing the Desktop extension

OpenCode Desktop currently accepts third-party GUI extension archives only in unpackaged/development builds, and it has no published installer UI for them yet. The `.ocdx` archive is ready for that extension manager; its main entry injects the overlay into each Desktop window and removes it when the extension is disabled.

In a packaged Desktop build the overlay must be included as a built-in main extension at build time. To use it right now in any Desktop build, paste the contents of `dist/deephub-overlay.js` into the Desktop renderer DevTools console. It mounts the same draggable pill and hover popup until the window reloads.

The Desktop overlay defaults to `deepseek-flash` and cycles models by click, because a main-only desktop extension cannot read the GUI's selected model without the renderer extension API.

## Development

```sh
npm install
npm run check
npm run build:desktop
```

`npm run check` runs the TypeScript check and the peak/pricing/overlay tests.
