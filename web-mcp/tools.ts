type JsonSchema = {
  type: "object" | "string";
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  enum?: string[];
};

// WebMCP 工具注解（可选提示）。参见命令式 API 文档：
// https://developer.chrome.com/docs/ai/webmcp/imperative-api
type ToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
  consequentialHint?: boolean;
};

// execute 第二个参数携带 AbortSignal，可用于取消长任务（本项目工具无需用到）。
type ExecuteOptions = { signal?: AbortSignal };

interface Tool<T = unknown> {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: ToolAnnotations;
  execute: (input: T, options?: ExecuteOptions) => unknown;
}

function objectSchema(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

function enumSchema<T extends string>(values: T[]): JsonSchema {
  return {
    type: "string",
    enum: values,
  };
}

export function defineTool<T>(options: {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: ToolAnnotations;
  execute: (input: T, options?: ExecuteOptions) => unknown;
}): Tool<T> {
  return {
    name: options.name,
    description: options.description,
    inputSchema: options.inputSchema,
    annotations: options.annotations,
    execute: options.execute,
  };
}

export const tools = [] as Tool<any>[];

type NavigateInput = {
  type: "blog" | "zhihu" | "github" | "steam";
};

tools.push(
  defineTool<NavigateInput>({
    name: "navigate",
    description: "Navigate to trudbot's other social media pages",
    inputSchema: objectSchema({
      type: enumSchema(["blog", "zhihu", "github", "steam"]),
    }),
    annotations: { readOnlyHint: false },
    execute({ type }) {
      const urls: Record<NavigateInput["type"], string> = {
        blog: "https://trudbot.cn/blog",
        zhihu: "https://www.zhihu.com/people/qu-ge-sha-ming-hao-ni-30",
        github: "https://github.com/trudbot",
        steam: "https://steamcommunity.com/id/trudboot/",
      };
      window.open(urls[type]);
      return `Opened trudbot's ${type} page`;
    },
  }),
);

tools.push(
  defineTool<Record<string, never>>({
    name: "shatter",
    description: "Trigger a glass shatter effect on the page",
    inputSchema: objectSchema({}),
    annotations: { readOnlyHint: false },
    async execute() {
      const { triggerShatter } = await import("@/lib/glass-shatter");
      await triggerShatter();
      return "Triggered the glass shatter effect";
    },
  }),
);
