import { build } from "esbuild"
import { strToU8, zipSync } from "fflate"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dist = path.join(root, "dist")
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"))

await mkdir(dist, { recursive: true })

const client = await build({
  entryPoints: [path.join(root, "src/desktop/client.ts")],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
})

const clientCode = client.outputFiles?.[0]?.text
if (!clientCode) throw new Error("Desktop client bundle produced no output")

const main = await build({
  entryPoints: [path.join(root, "src/desktop/main.ts")],
  bundle: true,
  write: false,
  format: "cjs",
  platform: "node",
  target: "node20",
  define: { __DEEPHUB_CLIENT__: JSON.stringify(clientCode) },
})

const mainCode = main.outputFiles?.[0]?.text
if (!mainCode) throw new Error("Desktop main bundle produced no output")

const manifest = {
  schema: "opencode.gui-extension/1",
  id: "deephub",
  name: "DeepHub",
  version: pkg.version,
  renderer: "renderer.js",
  main: "main.js",
  imports: { renderer: [], main: [] },
}

const archive = zipSync({
  "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
  "main.js": strToU8(mainCode),
  "renderer.js": strToU8("module.exports = {}\n"),
})

await writeFile(path.join(dist, "deephub-overlay.js"), clientCode)
await writeFile(path.join(dist, `deephub-${pkg.version}.ocdx`), archive)

console.log(`Built dist/deephub-overlay.js (${clientCode.length} bytes)`)
console.log(`Built dist/deephub-${pkg.version}.ocdx (${archive.byteLength} bytes)`)
