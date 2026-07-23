export interface UrlParameter {
  key: string;
  rawKey: string;
  value: string;
  rawValue: string;
  decodedValue?: string;
  formattedJson?: string;
}

export interface ParsedUrl {
  scheme: string;
  host: string;
  path: string;
  hash: string;
  parameters: UrlParameter[];
}

function decodeQueryComponent(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function formatJson(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (parsed === null || typeof parsed !== "object") return undefined;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return undefined;
  }
}

function parseParameters(query: string): UrlParameter[] {
  if (!query) return [];

  return query.split("&").map((entry) => {
    const separatorIndex = entry.indexOf("=");
    const rawKey = separatorIndex === -1 ? entry : entry.slice(0, separatorIndex);
    const rawValue = separatorIndex === -1 ? "" : entry.slice(separatorIndex + 1);
    const key = decodeQueryComponent(rawKey);
    const value = decodeQueryComponent(rawValue);
    const formattedJson = formatJson(value);

    return {
      key,
      rawKey,
      value,
      rawValue,
      ...(value !== rawValue ? { decodedValue: value } : {}),
      ...(formattedJson ? { formattedJson } : {}),
    };
  });
}

export function parseUrl(input: string): ParsedUrl {
  const trimmed = input.trim();

  // Check that input contains a scheme (e.g. "https:", "baiduboxapp:")
  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+\-.]*):\/\//);
  if (!schemeMatch) {
    throw new Error("请输入包含协议的完整 URL（如 https://… 或 custom://…）");
  }

  // Try native URL parser first — works for http/https and many schemes
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("请输入包含协议的完整 URL（如 https://… 或 custom://…）");
  }

  const scheme = url.protocol.replace(/:$/, "");

  // For standard origins (http, https, etc.), use native parsing directly
  if (url.origin !== "null") {
    const query = url.search.slice(1);
    return {
      scheme,
      host: url.host,
      path: url.pathname,
      hash: url.hash.slice(1),
      parameters: parseParameters(query),
    };
  }

  // For opaque/custom schemes, parse manually from the href
  // url.href normalizes the input; extract the part after "scheme://"
  const afterScheme = url.href.slice(url.protocol.length + 2); // skip "scheme://"

  // Split on '?' first to separate path from query+hash
  const questionIdx = afterScheme.indexOf("?");
  const pathAndHost = questionIdx === -1 ? afterScheme : afterScheme.slice(0, questionIdx);
  const queryAndHash = questionIdx === -1 ? "" : afterScheme.slice(questionIdx + 1);

  // Split query from hash
  const hashIdx = queryAndHash.indexOf("#");
  const query = hashIdx === -1 ? queryAndHash : queryAndHash.slice(0, hashIdx);
  const hash = hashIdx === -1 ? "" : queryAndHash.slice(hashIdx + 1);

  // But hash could also be in the pathAndHost part (no query string case)
  let host: string;
  let path: string;
  let finalHash = hash;

  if (questionIdx === -1) {
    // No query — check for hash in pathAndHost
    const pathHashIdx = pathAndHost.indexOf("#");
    const fullPath = pathHashIdx === -1 ? pathAndHost : pathAndHost.slice(0, pathHashIdx);
    finalHash = pathHashIdx === -1 ? "" : pathAndHost.slice(pathHashIdx + 1);

    const slashIdx = fullPath.indexOf("/");
    host = slashIdx === -1 ? fullPath : fullPath.slice(0, slashIdx);
    path = slashIdx === -1 ? "" : fullPath.slice(slashIdx);
  } else {
    const slashIdx = pathAndHost.indexOf("/");
    host = slashIdx === -1 ? pathAndHost : pathAndHost.slice(0, slashIdx);
    path = slashIdx === -1 ? "" : pathAndHost.slice(slashIdx);
  }

  return {
    scheme,
    host,
    path,
    hash: finalHash,
    parameters: parseParameters(query),
  };
}
