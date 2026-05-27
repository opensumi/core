import { Injectable } from '@opensumi/di';

import type {
  WebMcpGroupDef,
  WebMcpGroupInfo,
  WebMcpToolResult,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

export interface WebMcpToolExecute {
  method: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<WebMcpToolResult>;
}

export interface WebMcpGroupRegistration {
  name: string;
  description: string;
  defaultLoaded: boolean;
  tools: WebMcpToolExecute[];
}

@Injectable()
export class WebMcpGroupRegistry {
  private groups = new Map<string, WebMcpGroupRegistration>();

  registerGroup(group: WebMcpGroupRegistration): void {
    if (this.groups.has(group.name)) {
      // eslint-disable-next-line no-console
      console.warn(`[WebMCP] Group "${group.name}" already registered, overwriting`);
    }
    this.groups.set(group.name, group);
  }

  getGroupDefinitions(): WebMcpGroupDef[] {
    return Array.from(this.groups.values()).map((g) => ({
      name: g.name,
      description: g.description,
      defaultLoaded: g.defaultLoaded,
      tools: g.tools.map((t) => ({
        method: t.method,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    }));
  }

  listGroups(loadedGroups: Set<string>): WebMcpGroupInfo[] {
    return Array.from(this.groups.values()).map((g) => ({
      name: g.name,
      description: g.description,
      toolCount: g.tools.length,
      loaded: loadedGroups.has(g.name),
    }));
  }

  executeTool(groupName: string, toolAction: string, params: Record<string, unknown>): Promise<WebMcpToolResult> {
    const group = this.groups.get(groupName);
    if (!group) {
      return Promise.resolve({
        success: false,
        error: 'TOOL_NOT_FOUND',
        details: `Group "${groupName}" not found`,
      });
    }
    const method = `_opensumi/${groupName}/${toolAction}`;
    const tool = group.tools.find((t) => t.method === method);
    if (!tool) {
      return Promise.resolve({
        success: false,
        error: 'TOOL_NOT_FOUND',
        details: `Tool "${method}" not found in group "${groupName}"`,
      });
    }
    return tool.execute(params);
  }

  getDefaultGroupNames(): string[] {
    return Array.from(this.groups.values())
      .filter((g) => g.defaultLoaded)
      .map((g) => g.name);
  }
}
