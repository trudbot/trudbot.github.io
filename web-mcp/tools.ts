type JsonSchema = {
    type: "object" | "string";
    properties?: Record<string, JsonSchema>;
    required?: string[];
    additionalProperties?: boolean;
    enum?: string[];
}

interface Tool<T = unknown> {
    name: string;
    description: string;
    inputSchema: JsonSchema;
    execute: (input: T) => unknown;
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
    execute: (input: T) => unknown;
}): Tool<T> {
    return {
        name: options.name,
        description: options.description,
        inputSchema: options.inputSchema,
        execute: options.execute,
    };
}

export const tools = [

] as Tool<any>[];

type NavigateInput = {
    type: "blog" | "zhihu" | "github" | "steam";
}

tools.push(defineTool<NavigateInput>({
    name: "navigate",
    description: "Navigate to trudbot's other social media pages",
    inputSchema: objectSchema({
        type: enumSchema(["blog", "zhihu", "github", "steam"]),
    }),
    execute({type}) {
        switch (type) {
            case "blog":
                window.open("https://trudbot.cn/blog");
                return;
            case "zhihu":
                window.open("https://www.zhihu.com/people/qu-ge-sha-ming-hao-ni-30");
                return;
            case "github":
                window.open("https://github.com/trudbot");
                return;
            case "steam":
                window.open("https://steamcommunity.com/id/trudboot/");
                return;
        }
    }
}));

tools.push(defineTool<Record<string, never>>({
    name: "shatter",
    description: "Trigger a glass shatter effect on the page",
    inputSchema: objectSchema({}),
    async execute() {
        const { triggerShatter } = await import("@/lib/glass-shatter");
        await triggerShatter();
    }
}))

