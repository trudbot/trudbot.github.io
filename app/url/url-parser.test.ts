import { describe, expect, it } from "vitest";
import { parseUrl } from "./url-parser";

describe("parseUrl", () => {
  it("returns the origin and an empty parameter list", () => {
    expect(parseUrl("https://example.com:8080/path#section")).toEqual({
      origin: "https://example.com:8080",
      parameters: [],
    });
  });

  it("preserves duplicate parameters in source order", () => {
    const result = parseUrl("https://example.com/?tag=one&tag=two&empty=");

    expect(result.parameters.map(({ key, rawValue, value }) => ({ key, rawValue, value }))).toEqual(
      [
        { key: "tag", rawValue: "one", value: "one" },
        { key: "tag", rawValue: "two", value: "two" },
        { key: "empty", rawValue: "", value: "" },
      ],
    );
  });

  it("shows the decoded value when a parameter is URL encoded", () => {
    const result = parseUrl("https://example.com/?message=%E4%BD%A0%E5%A5%BD+world");

    expect(result.parameters[0]).toMatchObject({
      key: "message",
      rawValue: "%E4%BD%A0%E5%A5%BD+world",
      value: "你好 world",
      decodedValue: "你好 world",
    });
  });

  it("formats encoded JSON after decoding it", () => {
    const payload = encodeURIComponent(JSON.stringify({ enabled: true, count: 2 }));
    const result = parseUrl(`https://example.com/?payload=${payload}`);

    expect(result.parameters[0]).toMatchObject({
      value: '{"enabled":true,"count":2}',
      formattedJson: '{\n  "enabled": true,\n  "count": 2\n}',
    });
  });

  it("formats a JSON string even when it is not percent encoded", () => {
    const result = parseUrl('https://example.com/?payload={"items":[1,2]}');

    expect(result.parameters[0].formattedJson).toBe('{\n  "items": [\n    1,\n    2\n  ]\n}');
  });

  it("does not classify JSON scalar values as structured JSON", () => {
    const result = parseUrl("https://example.com/?number=1&boolean=true&nil=null&text=%22hello%22");

    expect(result.parameters.map((parameter) => parameter.formattedJson)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("keeps malformed escape sequences readable", () => {
    const result = parseUrl("https://example.com/?value=%E0%A4%A");

    expect(result.parameters[0]).toMatchObject({
      rawValue: "%E0%A4%A",
      value: "%E0%A4%A",
    });
  });

  it("rejects text that is not an absolute URL", () => {
    expect(() => parseUrl("example.com/path?value=1")).toThrow("请输入包含协议的完整 URL");
  });
});
