import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverPages } from "./discover-pages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedDir = path.join(root, "src/generated");
const entriesDir = path.join(generatedDir, "entries");
const pageCssDir = path.join(generatedDir, "page-css");
const themeTokensCss = path.join(root, "app/theme-tokens.css");

const RESOLVE_EXTS = [".tsx", ".ts", ".jsx", ".js"];
// 只有这些扩展名的文件才含有 Tailwind class，需要被 @source 扫描。
const SOURCE_EXTS = new Set([".tsx", ".ts", ".jsx", ".js"]);

// 从一个 import 说明符解析出本地文件路径（忽略第三方包）。
function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = path.join(root, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null;

  for (const ext of RESOLVE_EXTS) {
    if (fsSync.existsSync(base + ext)) return base + ext;
  }
  for (const ext of RESOLVE_EXTS) {
    const indexed = path.join(base, `index${ext}`);
    if (fsSync.existsSync(indexed)) return indexed;
  }
  if (fsSync.existsSync(base) && fsSync.statSync(base).isFile()) return base;
  return null;
}

const IMPORT_RE =
  /(?:import|export)[^;]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|import\s*["']([^"']+)["']/g;

function fileImports(file) {
  const src = fsSync.readFileSync(file, "utf8");
  const specs = [];
  let match;
  while ((match = IMPORT_RE.exec(src))) specs.push(match[1] || match[2] || match[3]);
  return specs;
}

// 计算某个页面（含静态与动态 import）可达的全部本地文件。
function collectSources(entryFile) {
  const seen = new Set();
  const stack = [entryFile];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of fileImports(file)) {
      const resolved = resolveImport(spec, file);
      if (resolved && !resolved.includes(`${path.sep}node_modules${path.sep}`))
        stack.push(resolved);
    }
  }
  return [...seen].filter((file) => SOURCE_EXTS.has(path.extname(file)));
}

function toPosixRelative(fromDir, target) {
  return path.relative(fromDir, target).split(path.sep).join("/");
}

// 为单个页面生成一份「只包含该页面用到的 utility」的 CSS。
// 本工具链下 Tailwind 的 @source 有几个限制，据此选择写法：
//   1. @source 指向具体文件无效，只能用目录或 glob；因此逐文件用去扩展名的 `*` glob 精确锁定，
//      避免把 components/ui 等目录里未使用的文件一起带进来。
//   2. glob 无法可靠地字面匹配路由分组目录里的圆括号（如 (home)）；这类目录只含该页面自身文件，
//      直接整目录扫描即可。
//   3. @source 不能与 @reference 共存（否则不生成任何 utility）；因此自定义 token（如 bg-primary）
//      改为 @import theme-tokens.css 引入其 @theme 映射，变量取值仍来自全局 app/globals.css 的 :root/.dark。
function pageCssContent(sources) {
  const themePath = toPosixRelative(pageCssDir, themeTokensCss);

  const lines = new Set();
  for (const file of sources) {
    const relDir = toPosixRelative(pageCssDir, path.dirname(file));
    if (relDir.includes("(")) {
      lines.add(`@source "${relDir}";`);
    } else {
      const stem = toPosixRelative(pageCssDir, file).replace(/\.[jt]sx?$/, "");
      lines.add(`@source "${stem}*";`);
    }
  }

  return `/* 由 scripts/generate-routes.mjs 自动生成，请勿手动修改。 */
@import "${themePath}";
@import "tailwindcss" source(none);
${[...lines].join("\n")}
`;
}

function routeSort(a, b) {
  if (a.route === "/") return -1;
  if (b.route === "/") return 1;
  return a.route.localeCompare(b.route);
}

function importPath(pageFile) {
  return `@/${pageFile.replace(/\.tsx$/, "").replace(/'/g, "\\'")}`;
}

export async function generateRoutes() {
  const pages = discoverPages({ root }).sort(routeSort);

  await fs.rm(generatedDir, { recursive: true, force: true });
  await fs.mkdir(entriesDir, { recursive: true });
  await fs.mkdir(pageCssDir, { recursive: true });

  await Promise.all(
    pages.map(async (page) => {
      const sources = collectSources(path.join(root, page.pageFile));
      const cssName = `${page.entryName}.css`;
      await fs.writeFile(path.join(pageCssDir, cssName), pageCssContent(sources));
      await fs.writeFile(
        path.join(root, page.entryFile),
        `import '../page-css/${cssName}'\nimport Page from '${importPath(page.pageFile)}'\nimport { mountPage } from '@/src/entry-client'\n\nmountPage(Page)\n`,
      );
    }),
  );

  const imports = pages
    .map((page, index) => `import Page${index} from '${importPath(page.pageFile)}'`)
    .join("\n");
  const routeList = pages.map((page) => `'${page.route}'`).join(", ");
  const pageMapEntries = pages.map((page, index) => `  '${page.route}': Page${index},`).join("\n");

  await fs.writeFile(
    path.join(generatedDir, "pages.ts"),
    `${imports}\nimport type { ComponentType } from 'react'\n\nexport const routesToPrerender = [${routeList}]\n\nexport const pages: Record<string, ComponentType> = {\n${pageMapEntries}\n}\n`,
  );

  await fs.writeFile(
    path.join(generatedDir, "route-manifest.json"),
    `${JSON.stringify(pages, null, 2)}\n`,
  );

  return pages;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await generateRoutes();
}
