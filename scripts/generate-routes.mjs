import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { discoverPages } from './discover-pages.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const generatedDir = path.join(root, 'src/generated')
const entriesDir = path.join(generatedDir, 'entries')

function routeSort(a, b) {
  if (a.route === '/') return -1
  if (b.route === '/') return 1
  return a.route.localeCompare(b.route)
}

function importPath(pageFile) {
  return `@/${pageFile.replace(/\.tsx$/, '').replace(/'/g, "\\'")}`
}

export async function generateRoutes() {
  const pages = discoverPages({ root }).sort(routeSort)

  await fs.rm(generatedDir, { recursive: true, force: true })
  await fs.mkdir(entriesDir, { recursive: true })

  await Promise.all(pages.map((page) => fs.writeFile(
    path.join(root, page.entryFile),
    `import Page from '${importPath(page.pageFile)}'\nimport { mountPage } from '@/src/entry-client'\n\nmountPage(Page)\n`,
  )))

  const imports = pages.map((page, index) => `import Page${index} from '${importPath(page.pageFile)}'`).join('\n')
  const routeList = pages.map((page) => `'${page.route}'`).join(', ')
  const pageMapEntries = pages.map((page, index) => `  '${page.route}': Page${index},`).join('\n')

  await fs.writeFile(path.join(generatedDir, 'pages.ts'), `${imports}\nimport type { ComponentType } from 'react'\n\nexport const routesToPrerender = [${routeList}]\n\nexport const pages: Record<string, ComponentType> = {\n${pageMapEntries}\n}\n`)

  await fs.writeFile(path.join(generatedDir, 'route-manifest.json'), `${JSON.stringify(pages, null, 2)}\n`)

  return pages
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await generateRoutes()
}
