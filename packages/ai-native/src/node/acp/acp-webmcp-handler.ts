import type { AcpWebMcpCallerService } from './acp-webmcp-caller.service';
import type {
  WebMcpGroupDef,
  WebMcpToolResult,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

export class AcpWebMcpHandler {
  private loadedGroups = new Set<string>();
  private groupDefs: WebMcpGroupDef[] | null = null;
  private totalLoadedToolCount = 0;
  private initPromise: Promise<void> | null = null;

  constructor(
    private readonly caller: AcpWebMcpCallerService,
    private readonly logger: { warn?: (...args: unknown[]) => void; debug?: (...args: unknown[]) => void } | undefined,
  ) {}

  /**
   * Lazily initialize group definitions from the browser-side registry.
   * Safe to call multiple times — subsequent calls await the same promise.
   */
  ensureInitialized(): Promise<void> {
    if (this.groupDefs !== null) {return Promise.resolve();}
    if (this.initPromise) {return this.initPromise;}

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      this.groupDefs = await this.caller.getGroupDefinitions();
      // Auto-load default groups
      for (const group of this.groupDefs) {
        if (group.defaultLoaded) {
          this.loadedGroups.add(group.name);
          this.totalLoadedToolCount += group.tools.length;
        }
      }
      this.logger?.debug?.(
        `[AcpWebMcpHandler] Initialized — groups=${this.groupDefs.map((g) => g.name).join(',')}, ` +
          `defaultLoaded=${[...this.loadedGroups].join(',')}, totalLoadedToolCount=${this.totalLoadedToolCount}`,
      );
    } catch (err) {
      this.logger?.warn?.('[AcpWebMcpHandler] Failed to initialize group definitions:', err);
      this.groupDefs = [];
    }
  }

  async handleExtMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    await this.ensureInitialized();
    this.logger?.debug?.(`[AcpWebMcpHandler] handleExtMethod() — method=${method}, params=${JSON.stringify(params)}`);

    // Meta methods
    if (method === '_opensumi/webmcp/list_groups') {
      const result = this.listGroups();
      this.logger?.debug?.(`[AcpWebMcpHandler] list_groups() — groups count=${(result.groups as any[])?.length ?? 0}`);
      return result;
    }
    if (method === '_opensumi/webmcp/load_group') {
      const result = this.loadGroup(params);
      this.logger?.debug?.(`[AcpWebMcpHandler] load_group(${params.name}) — loaded=${!(result as any).error}, totalLoadedToolCount=${(result as any).totalLoadedToolCount}`);
      return result;
    }
    if (method === '_opensumi/webmcp/unload_group') {
      const result = this.unloadGroup(params);
      this.logger?.debug?.(`[AcpWebMcpHandler] unload_group(${params.name}) — unloadedMethods=${JSON.stringify((result as any).unloadedMethods)}, totalLoadedToolCount=${(result as any).totalLoadedToolCount}`);
      return result;
    }

    // Group tool methods: _opensumi/{group}/{action}
    if (method.startsWith('_opensumi/')) {
      const result = await this.executeGroupTool(method, params);
      this.logger?.debug?.(`[AcpWebMcpHandler] executeGroupTool(${method}) — success=${(result as any).error ? false : true}`);
      return result;
    }

    throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
  }

  handleExtNotification(method: string, _params: Record<string, unknown>): void {
    this.logger?.debug?.(`[AcpWebMcpHandler] extNotification: ${method}`);
  }

  private listGroups(): Record<string, unknown> {
    const groups = (this.groupDefs ?? []).map((g) => ({
      name: g.name,
      description: g.description,
      defaultLoaded: g.defaultLoaded,
      loaded: this.loadedGroups.has(g.name),
      tools: g.tools.map((t) => ({
        method: t.method,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    }));
    return { groups };
  }

  private loadGroup(params: Record<string, unknown>): Record<string, unknown> {
    const name = params.name as string;
    const group = (this.groupDefs ?? []).find((g) => g.name === name);
    if (!group) {
      return { error: 'GROUP_NOT_FOUND', details: `Group "${name}" not found` };
    }
    const tools = group.tools.map((t) => ({
      method: t.method,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
    if (this.loadedGroups.has(name)) {
      return {
        group: name,
        tools,
        totalLoadedToolCount: this.totalLoadedToolCount,
      };
    }
    this.loadedGroups.add(name);
    this.totalLoadedToolCount += group.tools.length;
    return { group: name, tools, totalLoadedToolCount: this.totalLoadedToolCount };
  }

  private unloadGroup(params: Record<string, unknown>): Record<string, unknown> {
    const name = params.name as string;
    const group = (this.groupDefs ?? []).find((g) => g.name === name);
    if (!group) {
      return { error: 'GROUP_NOT_FOUND', details: `Group "${name}" not found` };
    }
    if (!this.loadedGroups.has(name)) {
      return { group: name, unloadedMethods: [], totalLoadedToolCount: this.totalLoadedToolCount };
    }
    this.loadedGroups.delete(name);
    this.totalLoadedToolCount -= group.tools.length;
    return {
      group: name,
      unloadedMethods: group.tools.map((t) => t.method),
      totalLoadedToolCount: this.totalLoadedToolCount,
    };
  }

  private async executeGroupTool(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Parse _opensumi/{group}/{action}
    // e.g. '_opensumi/file/read'.split('/') => ['_opensumi', 'file', 'read']
    const parts = method.split('/');
    if (parts.length !== 3 || parts[0] !== '_opensumi') {
      return { success: false, error: 'TOOL_NOT_FOUND', details: `Invalid method: ${method}` };
    }
    const groupName = parts[1];
    const toolAction = parts[2];

    if (!this.loadedGroups.has(groupName)) {
      this.logger?.warn?.(`[AcpWebMcpHandler] executeGroupTool(${method}) — group "${groupName}" not loaded. Loaded groups: ${[...this.loadedGroups].join(',')}`);
      return {
        success: false,
        error: 'TOOL_NOT_LOADED',
        details: `Group "${groupName}" is not loaded. Call _opensumi/webmcp/load_group first.`,
      };
    }

    try {
      this.logger?.debug?.(`[AcpWebMcpHandler] executeGroupTool() — calling browser: group=${groupName}, action=${toolAction}`);
      const result = await this.caller.executeTool(groupName, toolAction, params);
      this.logger?.debug?.(`[AcpWebMcpHandler] executeGroupTool() — browser returned: group=${groupName}, action=${toolAction}, success=${result.success}`);
      return result as unknown as Record<string, unknown>;
    } catch (err) {
      this.logger?.warn?.(`[AcpWebMcpHandler] executeGroupTool(${method}) — execution error:`, err);
      return { success: false, error: 'EXECUTION_ERROR', details: String(err) };
    }
  }

  getCapabilityMeta(): Record<string, unknown> {
    return {
      opensumi: {
        version: '1.0',
        webmcp: {
          methods: [
            '_opensumi/webmcp/list_groups',
            '_opensumi/webmcp/load_group',
            '_opensumi/webmcp/unload_group',
          ],
          groups: (this.groupDefs ?? []).map((g) => g.name),
          defaultLoadedGroups: (this.groupDefs ?? []).filter((g) => g.defaultLoaded).map((g) => g.name),
        },
      },
    };
  }
}
