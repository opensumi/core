import type { AcpWebMcpCallerService } from './acp-webmcp-caller.service';
import type {
  WebMcpGroupDef,
  WebMcpGroupInfo,
  WebMcpToolResult,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

export class AcpWebMcpHandler {
  private loadedGroups = new Set<string>();
  private groupDefs: WebMcpGroupDef[] | null = null;
  private totalLoadedToolCount = 0;

  constructor(
    private readonly caller: AcpWebMcpCallerService,
    private readonly logger: { warn?: (...args: unknown[]) => void; debug?: (...args: unknown[]) => void } | undefined,
  ) {}

  async initialize(): Promise<void> {
    try {
      this.groupDefs = await this.caller.getGroupDefinitions();
      // Auto-load default groups
      for (const group of this.groupDefs) {
        if (group.defaultLoaded) {
          this.loadedGroups.add(group.name);
          this.totalLoadedToolCount += group.tools.length;
        }
      }
    } catch (err) {
      this.logger?.warn?.('[AcpWebMcpHandler] Failed to initialize group definitions:', err);
      this.groupDefs = [];
    }
  }

  async handleExtMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Meta methods
    if (method === '_opensumi/webmcp/list_groups') {
      return this.listGroups();
    }
    if (method === '_opensumi/webmcp/load_group') {
      return this.loadGroup(params);
    }
    if (method === '_opensumi/webmcp/unload_group') {
      return this.unloadGroup(params);
    }

    // Group tool methods: _opensumi/{group}/{action}
    if (method.startsWith('_opensumi/')) {
      return this.executeGroupTool(method, params);
    }

    throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
  }

  handleExtNotification(method: string, _params: Record<string, unknown>): void {
    this.logger?.debug?.(`[AcpWebMcpHandler] extNotification: ${method}`);
  }

  private listGroups(): Record<string, unknown> {
    const groups = (this.groupDefs ?? []).map(
      (g): WebMcpGroupInfo => ({
        name: g.name,
        description: g.description,
        toolCount: g.tools.length,
        loaded: this.loadedGroups.has(g.name),
      }),
    );
    return { groups };
  }

  private loadGroup(params: Record<string, unknown>): Record<string, unknown> {
    const name = params.name as string;
    const group = (this.groupDefs ?? []).find((g) => g.name === name);
    if (!group) {
      return { error: 'GROUP_NOT_FOUND', details: `Group "${name}" not found` };
    }
    if (this.loadedGroups.has(name)) {
      return {
        group: name,
        methods: group.tools.map((t) => t.method),
        totalLoadedToolCount: this.totalLoadedToolCount,
      };
    }
    this.loadedGroups.add(name);
    this.totalLoadedToolCount += group.tools.length;
    return { group: name, methods: group.tools.map((t) => t.method), totalLoadedToolCount: this.totalLoadedToolCount };
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
      return {
        success: false,
        error: 'TOOL_NOT_LOADED',
        details: `Group "${groupName}" is not loaded. Call _opensumi/webmcp/load_group first.`,
      };
    }

    try {
      const result = await this.caller.executeTool(groupName, toolAction, params);
      return result as unknown as Record<string, unknown>;
    } catch (err) {
      return { success: false, error: 'EXECUTION_ERROR', details: String(err) };
    }
  }

  getCapabilityMeta(): Record<string, unknown> {
    return {
      opensumi: {
        version: '1.0',
        webmcpGroups: (this.groupDefs ?? []).map((g) => g.name),
        defaultLoadedGroups: (this.groupDefs ?? []).filter((g) => g.defaultLoaded).map((g) => g.name),
      },
    };
  }
}
