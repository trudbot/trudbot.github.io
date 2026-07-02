import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";
import { generateRoutes } from "./generate-routes.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "out");
const ssrOutDir = path.join(root, ".vite-ssg");

await generateRoutes();

await fs.rm(outDir, { recursive: true, force: true });
await fs.rm(ssrOutDir, { recursive: true, force: true });

await build({
  root,
  configFile: path.join(root, "vite.config.ts"),
});

await build({
  root,
  configFile: path.join(root, "vite.config.ts"),
  build: {
    ssr: path.join(root, "src/entry-server.tsx"),
    outDir: ssrOutDir,
    emptyOutDir: true,
  },
});

const template = await fs.readFile(path.join(root, "index.html"), "utf-8");
const manifest = JSON.parse(
  await fs.readFile(path.join(outDir, ".vite", "manifest.json"), "utf-8"),
);
const routeManifest = JSON.parse(
  await fs.readFile(path.join(root, "src/generated/route-manifest.json"), "utf-8"),
);
const routeEntries = Object.fromEntries(routeManifest.map((page) => [page.route, page.entryFile]));
const serverEntry = await import(pathToFileURL(path.join(ssrOutDir, "entry-server.mjs")).href);

function collectAssets(entryKey, seen = new Set()) {
  const entry = manifest[entryKey];
  if (!entry || seen.has(entryKey)) return { css: [], imports: [] };
  seen.add(entryKey);

  const childAssets = (entry.imports || []).map((key) => collectAssets(key, seen));
  return {
    css: [
      ...childAssets.flatMap((assets) => assets.css),
      ...(entry.css || []),
      ...(entry.dynamicImports || []).flatMap((key) => manifest[key]?.css || []),
    ],
    imports: [...childAssets.flatMap((assets) => assets.imports), ...(entry.imports || [])],
  };
}

function pageClientAssets(route) {
  const entryKey = routeEntries[route];
  const entry = manifest[entryKey];
  if (!entry) throw new Error(`Missing client entry in manifest: ${entryKey}`);

  const assets = collectAssets(entryKey);
  const css = [...new Set(assets.css)];
  const imports = [...new Set(assets.imports.map((key) => manifest[key]?.file).filter(Boolean))];

  return { css, imports, entryFile: entry.file };
}

function pageHeadAssets(route) {
  const assets = pageClientAssets(route);

  return [
    ...assets.css.map((file) => `    <link rel="stylesheet" crossorigin href="/${file}">`),
    ...assets.imports.map((file) => `    <link rel="modulepreload" crossorigin href="/${file}">`),
  ].join("\n");
}

function shareReceiveBootstrap() {
  return `    <script>
(function(){
  function decompressFromEncodedURIComponent(input) {
    if (!input) return "";
    input = input.replace(/ /g, "+");
    var key = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
    var base = Object.create(null);
    for (var index = 0; index < key.length; index++) base[key.charAt(index)] = index;
    return decompress(input.length, 32, function(index) { return base[input.charAt(index)]; }) || "";
  }

  function decompress(length, resetValue, getNextValue) {
    var dictionary = [], enlargeIn = 4, dictSize = 4, numBits = 3, entry = "", result = [], i, w, bits, resb, maxpower, power, c;
    var data = { val: getNextValue(0), position: resetValue, index: 1 };
    for (i = 0; i < 3; i += 1) dictionary[i] = i;
    bits = 0;
    maxpower = Math.pow(2, 2);
    power = 1;
    while (power !== maxpower) {
      resb = data.val & data.position;
      data.position >>= 1;
      if (data.position === 0) {
        data.position = resetValue;
        data.val = getNextValue(data.index++);
      }
      bits |= (resb > 0 ? 1 : 0) * power;
      power <<= 1;
    }
    switch (bits) {
      case 0:
        bits = 0;
        maxpower = Math.pow(2, 8);
        power = 1;
        while (power !== maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position === 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        c = String.fromCharCode(bits);
        break;
      case 1:
        bits = 0;
        maxpower = Math.pow(2, 16);
        power = 1;
        while (power !== maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position === 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        c = String.fromCharCode(bits);
        break;
      case 2:
        return "";
    }
    dictionary[3] = c;
    w = c;
    result.push(c);
    while (true) {
      if (data.index > length) return "";
      bits = 0;
      maxpower = Math.pow(2, numBits);
      power = 1;
      while (power !== maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position === 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }
      c = bits;
      switch (c) {
        case 0:
          bits = 0;
          maxpower = Math.pow(2, 8);
          power = 1;
          while (power !== maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position === 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          dictionary[dictSize++] = String.fromCharCode(bits);
          c = dictSize - 1;
          enlargeIn--;
          break;
        case 1:
          bits = 0;
          maxpower = Math.pow(2, 16);
          power = 1;
          while (power !== maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position === 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          dictionary[dictSize++] = String.fromCharCode(bits);
          c = dictSize - 1;
          enlargeIn--;
          break;
        case 2:
          return result.join("");
      }
      if (enlargeIn === 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
      if (dictionary[c]) {
        entry = dictionary[c];
      } else {
        if (c !== dictSize) return "";
        entry = w + w.charAt(0);
      }
      result.push(entry);
      dictionary[dictSize++] = w + entry.charAt(0);
      w = entry;
      enlargeIn--;
      if (enlargeIn === 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
    }
  }

  var params = new URLSearchParams(location.search);
  var content = params.get("content") || decompressFromEncodedURIComponent(params.get("compressed"));
  if (!content) return;
  var shell = document.querySelector("[data-share-receive-shell]");
  if (!shell) return;
  var empty = shell.querySelector("[data-share-empty]");
  var result = shell.querySelector("[data-share-result]");
  var contentNode = shell.querySelector("[data-share-content]");
  var badge = shell.querySelector("[data-share-status-badge]");
  var note = shell.querySelector("[data-share-status-note]");
  var title = shell.querySelector("[data-share-title]");
  if (empty) empty.hidden = true;
  if (result) result.hidden = false;
  if (contentNode) contentNode.textContent = content;
  if (badge) {
    badge.classList.remove("text-share-badge-orange");
    badge.classList.add("text-share-badge-green");
    badge.textContent = "扫码成功";
  }
  if (note) note.textContent = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
  if (title) title.innerHTML = "收到<br>内容";
  try {
    var url = new URL(content);
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    var linkRow = shell.querySelector("[data-share-link-row]");
    var source = shell.querySelector("[data-share-source]");
    if (linkRow) linkRow.hidden = false;
    if (source) source.textContent = url.href;
  } catch (_) {}
})();
    </script>`;
}

function pageBodyAssets(route) {
  const assets = pageClientAssets(route);
  const bootstrap = route === "/share/r" ? `${shareReceiveBootstrap()}\n` : "";

  return `${bootstrap}    <script type="module" crossorigin src="/${assets.entryFile}"></script>`;
}

for (const route of serverEntry.routesToPrerender) {
  const appHtml = serverEntry.render(route);
  const html = template
    .replace("<!--page-assets-->", pageHeadAssets(route))
    .replace("<!--app-html-->", appHtml)
    .replace("<!--body-assets-->", pageBodyAssets(route));
  const filePaths =
    route === "/"
      ? [path.join(outDir, "index.html")]
      : [
          path.join(outDir, route.slice(1), "index.html"),
          path.join(outDir, `${route.slice(1)}.html`),
        ];

  for (const filePath of filePaths) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, html);
  }
}

await fs.rm(ssrOutDir, { recursive: true, force: true });
