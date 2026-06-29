import { tools } from "./tools";

interface ModelContext {
    registerTool(tool: unknown): void;
}

export function registerWebMcp() {
    const modelContext = (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
    if (modelContext) {
        tools.forEach(tool => modelContext.registerTool(tool));
    }
}