import fs from "node:fs";
import path from "node:path";

// 页面文件名 → 页面所用的 UI 框架。每个框架在 src/runtime/ 有对应的挂载器，
// 在 src/entry-server.tsx 有对应的 SSR 渲染器；新增框架时三处需同步。
export const PAGE_FRAMEWORKS = {
  "page.tsx": "react",
  "page.vue": "vue",
};

// Vapor 与 VDOM 组件的客户端挂载 API 不同（createVaporSSRApp / createSSRApp），
// 且各自只应把用到的那套运行时打进产物，因此在构建期按 SFC 的 `<script vapor>`
// 区分，而不是在运行时判断。
const VAPOR_SCRIPT_RE = /<script\b[^>]*\svapor\b[^>]*>/;

function pageFramework(pageFile) {
  const framework = PAGE_FRAMEWORKS[path.basename(pageFile)];
  if (framework === "vue" && VAPOR_SCRIPT_RE.test(fs.readFileSync(pageFile, "utf8"))) {
    return "vue-vapor";
  }
  return framework;
}

// 生成的 entry 只引用挂载器，不含 JSX；React 挂载器本身是 .tsx 由其自己处理。
const ENTRY_EXT = ".ts";

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function walkPages(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkPages(filePath, files);
    } else if (entry.isFile() && Object.hasOwn(PAGE_FRAMEWORKS, entry.name)) {
      files.push(filePath);
    }
  }

  return files;
}

function routeFromPage(appDir, pageFile) {
  const relative = toPosix(path.relative(appDir, path.dirname(pageFile)));
  const segments = relative.split("/").filter((segment) => segment && !/^\(.+\)$/.test(segment));

  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

function entryNameFromRoute(route, pageFile) {
  if (route !== "/") return route.slice(1).replace(/\//g, "-");

  const parent = path.basename(path.dirname(pageFile));
  return parent.replace(/^\((.+)\)$/, "$1") || "index";
}

export function discoverPages({ root = process.cwd(), appDir = path.join(root, "app") } = {}) {
  const pageFiles = walkPages(appDir).sort((a, b) => toPosix(a).localeCompare(toPosix(b)));
  const routes = new Map();
  const entryNames = new Map();

  return pageFiles.map((pageFile) => {
    const route = routeFromPage(appDir, pageFile);
    const entryName = entryNameFromRoute(route, pageFile);

    // 同目录同时存在 page.tsx 与 page.vue 也会落到这里。
    if (routes.has(route)) {
      throw new Error(
        `Duplicate route '${route}' from ${toPosix(pageFile)} and ${toPosix(routes.get(route))}`,
      );
    }
    if (entryNames.has(entryName)) {
      throw new Error(
        `Duplicate entry '${entryName}' from ${toPosix(pageFile)} and ${toPosix(entryNames.get(entryName))}`,
      );
    }

    routes.set(route, pageFile);
    entryNames.set(entryName, pageFile);

    return {
      route,
      entryName,
      framework: pageFramework(pageFile),
      pageFile: toPosix(path.relative(root, pageFile)),
      entryFile: `src/generated/entries/${entryName}${ENTRY_EXT}`,
    };
  });
}
