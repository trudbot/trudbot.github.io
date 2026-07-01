import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'
import { generateRoutes } from './generate-routes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'out')
const ssrOutDir = path.join(root, '.vite-ssg')

await generateRoutes()

await fs.rm(outDir, { recursive: true, force: true })
await fs.rm(ssrOutDir, { recursive: true, force: true })

await build({
  root,
  configFile: path.join(root, 'vite.config.ts'),
})

await build({
  root,
  configFile: path.join(root, 'vite.config.ts'),
  build: {
    ssr: path.join(root, 'src/entry-server.tsx'),
    outDir: ssrOutDir,
    emptyOutDir: true,
  },
})

const template = await fs.readFile(path.join(root, 'index.html'), 'utf-8')
const manifest = JSON.parse(await fs.readFile(path.join(outDir, '.vite', 'manifest.json'), 'utf-8'))
const routeManifest = JSON.parse(await fs.readFile(path.join(root, 'src/generated/route-manifest.json'), 'utf-8'))
const routeEntries = Object.fromEntries(routeManifest.map((page) => [page.route, page.entryFile]))
const serverEntry = await import(pathToFileURL(path.join(ssrOutDir, 'entry-server.mjs')).href)

function collectAssets(entryKey, seen = new Set()) {
  const entry = manifest[entryKey]
  if (!entry || seen.has(entryKey)) return { css: [], imports: [] }
  seen.add(entryKey)

  const childAssets = (entry.imports || []).map((key) => collectAssets(key, seen))
  return {
    css: [...childAssets.flatMap((assets) => assets.css), ...(entry.css || []), ...(entry.dynamicImports || []).flatMap((key) => manifest[key]?.css || [])],
    imports: [...childAssets.flatMap((assets) => assets.imports), ...(entry.imports || [])],
  }
}

function pageClientAssets(route) {
  const entryKey = routeEntries[route]
  const entry = manifest[entryKey]
  if (!entry) throw new Error(`Missing client entry in manifest: ${entryKey}`)

  const assets = collectAssets(entryKey)
  const css = [...new Set(assets.css)]
  const imports = [...new Set(assets.imports.map((key) => manifest[key]?.file).filter(Boolean))]

  return { css, imports, entryFile: entry.file }
}

function pageHeadAssets(route) {
  const assets = pageClientAssets(route)

  return [
    ...assets.css.map((file) => `    <link rel="stylesheet" crossorigin href="/${file}">`),
    ...assets.imports.map((file) => `    <link rel="modulepreload" crossorigin href="/${file}">`),
  ].join('\n')
}

function pageBodyAssets(route) {
  const assets = pageClientAssets(route)

  return `    <script type="module" crossorigin src="/${assets.entryFile}"></script>`
}

for (const route of serverEntry.routesToPrerender) {
  const appHtml = serverEntry.render(route)
  const html = template
    .replace('<!--page-assets-->', pageHeadAssets(route))
    .replace('<!--app-html-->', `${appHtml}\n${pageBodyAssets(route)}`)
  const filePaths = route === '/'
    ? [path.join(outDir, 'index.html')]
    : [
        path.join(outDir, route.slice(1), 'index.html'),
        path.join(outDir, `${route.slice(1)}.html`),
      ]

  for (const filePath of filePaths) {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, html)
  }
}

await fs.rm(ssrOutDir, { recursive: true, force: true })
