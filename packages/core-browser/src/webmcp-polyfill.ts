/**
 * WebMCP `navigator.modelContext` polyfill.
 *
 * Three runtime cases are handled, in priority order:
 *
 * 1. **Full native** — `modelContext` already exposes both `registerTool` and `executeTool`.
 *    Nothing to do.
 * 2. **Chrome split API** — `modelContext.registerTool` is native, but execution methods live
 *    on `navigator.modelContextTesting` (`executeTool`/`listTools`). We attach `executeTool`
 *    and `getTools` adapters onto `modelContext` so legacy callers (tests, external agents
 *    that use `modelContext.executeTool`) keep working. The adapter handles the JSON
 *    string ⇄ object boundary: Chrome's native API takes/returns JSON strings; the polyfill
 *    contract is plain objects.
 * 3. **No native API** — install a Map-backed shim that implements register + execute.
 *    External agents are expected to import the same module to get a working surface.
 *
 * Only the registration + execution surface is provided. SSE transport / session management
 * is the agent's responsibility.
 */
import type { NavigatorModelContext, WebMCPTool } from './webmcp-types';

export { WebMCPTool, NavigatorModelContext } from './webmcp-types';

interface NativeModelContextTesting {
  executeTool(name: string, argsJson: string): Promise<string>;
  listTools(): Array<{ name: string; description: string; inputSchema: string | object }>;
}

declare global {
  interface Navigator {
    modelContext?: NavigatorModelContext;
    modelContextTesting?: NativeModelContextTesting;
  }
}

export function ensureModelContext() {
  const mc = navigator.modelContext as (NavigatorModelContext & { executeTool?: unknown }) | undefined;
  const native = navigator.modelContextTesting;

  if (mc && typeof mc.registerTool === 'function' && typeof mc.executeTool === 'function') {
    return;
  }

  if (mc && typeof mc.registerTool === 'function' && native && typeof native.executeTool === 'function') {
    const target = mc as NavigatorModelContext & {
      executeTool?: NavigatorModelContext['executeTool'];
      getTools?: NavigatorModelContext['getTools'];
    };
    target.executeTool = async (name: string, args: unknown) => {
      const raw = await native.executeTool(name, JSON.stringify(args ?? {}));
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    };
    target.getTools = () => {
      const tools = native.listTools?.() || [];
      return tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema:
          typeof t.inputSchema === 'string' ? JSON.parse(t.inputSchema) : (t.inputSchema as WebMCPTool['inputSchema']),
      }));
    };
    return;
  }

  const tools = new Map<string, WebMCPTool & { signal?: AbortSignal }>();

  const ctx: NavigatorModelContext = {
    registerTool(tool: WebMCPTool, options?: { signal?: AbortSignal }) {
      tools.set(tool.name, { ...tool, signal: options?.signal });
      return { dispose: () => tools.delete(tool.name) };
    },

    async executeTool(name: string, args: any) {
      const tool = tools.get(name);
      if (!tool) {
        return {
          success: false,
          error: 'TOOL_NOT_FOUND',
          details: `Tool "${name}" is not registered`,
        };
      }
      if (tool.signal?.aborted) {
        return {
          success: false,
          error: 'TOOL_DISPOSED',
          details: `Tool "${name}" has been disposed`,
        };
      }
      return tool.execute(args);
    },

    getTools() {
      return Array.from(tools.values()).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
    },
  };

  navigator.modelContext = ctx;
}
