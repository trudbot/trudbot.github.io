import LZString from "lz-string";

export function decodeShareContent(search: string) {
  const searchParams = new URLSearchParams(search);
  const compressed = searchParams.get("compressed");
  if (compressed) return LZString.decompressFromEncodedURIComponent(compressed) || "";
  return searchParams.get("content") || "";
}

export function getOpenableUrl(content: string) {
  try {
    const url = new URL(content);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}
