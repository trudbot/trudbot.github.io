export interface UrlParameter {
  key: string;
  rawKey: string;
  value: string;
  rawValue: string;
  decodedValue?: string;
  formattedJson?: string;
}

export interface ParsedUrl {
  origin: string;
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

export function parseUrl(input: string): ParsedUrl {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("请输入包含协议的完整 URL");
  }

  if (url.origin === "null") {
    throw new Error("请输入包含协议的完整 URL");
  }

  const query = url.search.slice(1);
  const parameters = query
    ? query.split("&").map((entry) => {
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
      })
    : [];

  return { origin: url.origin, parameters };
}
