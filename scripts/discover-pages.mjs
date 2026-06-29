import fs from 'node:fs'
import path from 'node:path'

function toPosix(filePath) {
  return filePath.split(path.sep).join('/')
}

function walkPages(dir, files = []) {
  if (!fs.existsSync(dir)) return files

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkPages(filePath, files)
    } else if (entry.isFile() && entry.name === 'page.tsx') {
      files.push(filePath)
    }
  }

  return files
}

function routeFromPage(appDir, pageFile) {
  const relative = toPosix(path.relative(appDir, pageFile))
  const segments = relative
    .replace(/\/page\.tsx$/, '')
    .split('/')
    .filter((segment) => !/^\(.+\)$/.test(segment))

  return segments.length === 0 ? '/' : `/${segments.join('/')}`
}

function entryNameFromRoute(route, pageFile) {
  if (route !== '/') return route.slice(1).replace(/\//g, '-')

  const parent = path.basename(path.dirname(pageFile))
  return parent.replace(/^\((.+)\)$/, '$1') || 'index'
}

export function discoverPages({ root = process.cwd(), appDir = path.join(root, 'app') } = {}) {
  const pageFiles = walkPages(appDir).sort((a, b) => toPosix(a).localeCompare(toPosix(b)))
  const routes = new Map()
  const entryNames = new Map()

  return pageFiles.map((pageFile) => {
    const route = routeFromPage(appDir, pageFile)
    const entryName = entryNameFromRoute(route, pageFile)

    if (routes.has(route)) {
      throw new Error(`Duplicate route '${route}' from ${toPosix(pageFile)} and ${toPosix(routes.get(route))}`)
    }
    if (entryNames.has(entryName)) {
      throw new Error(`Duplicate entry '${entryName}' from ${toPosix(pageFile)} and ${toPosix(entryNames.get(entryName))}`)
    }

    routes.set(route, pageFile)
    entryNames.set(entryName, pageFile)

    return {
      route,
      entryName,
      pageFile: toPosix(path.relative(root, pageFile)),
      entryFile: `src/generated/entries/${entryName}.tsx`,
    }
  })
}
