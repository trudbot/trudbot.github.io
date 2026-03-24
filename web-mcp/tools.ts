import { z, type ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

interface Tool<T = unknown> {
    name: string;
    description: string;
    inputSchema: ReturnType<typeof zodToJsonSchema>;
    execute: (input: T) => unknown;
    // _parse: (raw: unknown) => T;
}

export function defineTool<T extends ZodType>(options: {
    name: string;
    description: string;
    input: T;
    execute: (input: z.infer<T>) => unknown;
}): Tool<z.infer<T>> {
    return {
        name: options.name,
        description: options.description,
        inputSchema: zodToJsonSchema(options.input),
        execute: options.execute,
        // _parse: (raw) => options.input.parse(raw),
    };
}

export const tools = [

] as Tool<any>[];


tools.push(defineTool({
    name: "navigate",
    description: "Navigate to trudbot's other social media pages",
    input: z.object({
        type: z.enum(["blog", "zhihu", "github", "steam"]),
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

tools.push(defineTool({
    name: "shatter",
    description: "Trigger a glass shatter effect on the page",
    input: z.object({}),
    async execute() {
        const { triggerShatter } = await import("@/lib/glass-shatter");
        await triggerShatter();
    }
}))

