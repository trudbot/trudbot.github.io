import { tools } from "./tools";

interface ModelContext {
    registerTool(tool: unknown): void;
}

declare global {
    interface Navigator {
        modelContext?: ModelContext;
    }
}

export function registerWebMcp() {
    if (navigator.modelContext) {
        tools.forEach(tool => navigator.modelContext!.registerTool(tool));
    }
}