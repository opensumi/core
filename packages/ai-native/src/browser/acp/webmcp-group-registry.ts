import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';

import type {
  WebMcpGroupDef,
  WebMcpGroupInfo,
  WebMcpToolResult,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

export type WebMcpToolRiskLevel = 'read' | 'write' | 'destructive' | 'shell' | 'ui';
export type WebMcpProfile = 'minimal' | 'default' | 'interactive' | 'full';

export const WEBMCP_PROFILE_SETTING_ID = 'ai.native.webmcp.profile';

export interface WebMcpGroupDefinitionOptions {
  includeAllTools?: boolean;
}

export interface WebMcpToolExecute {
  method: string;
  description: string;
  inputSchema: Record<string, unknown>;
  riskLevel?: WebMcpToolRiskLevel;
  exposedByDefault?: boolean;
  profiles?: WebMcpProfile[];
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
  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  private groups = new Map<string, WebMcpGroupRegistration>();

  registerGroup(group: WebMcpGroupRegistration): void {
    if (this.groups.has(group.name)) {
      // eslint-disable-next-line no-console
      console.warn(`[WebMCP] Group "${group.name}" already registered, overwriting`);
    }
    this.groups.set(group.name, group);
  }

  getGroupDefinitions(options?: WebMcpGroupDefinitionOptions): WebMcpGroupDef[] {
    const profile = this.getActiveProfile();
    return Array.from(this.groups.values()).map((g) => ({
      name: g.name,
      description: g.description,
      defaultLoaded: g.defaultLoaded,
      profile,
      tools: g.tools
        .filter((t) => options?.includeAllTools || this.isToolInProfile(t, profile))
        .map((t) => ({
          method: t.method,
          description: t.description,
          inputSchema: t.inputSchema,
          riskLevel: t.riskLevel,
          exposedByDefault: t.exposedByDefault,
          profiles: t.profiles,
        })) as WebMcpGroupDef['tools'],
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

  private getActiveProfile(): WebMcpProfile {
    const profile = this.preferenceService?.get<WebMcpProfile>(WEBMCP_PROFILE_SETTING_ID, 'default');
    if (profile === 'minimal' || profile === 'default' || profile === 'interactive' || profile === 'full') {
      return profile;
    }
    return 'default';
  }

  private isToolInProfile(tool: WebMcpToolExecute, profile: WebMcpProfile): boolean {
    if (tool.profiles?.length) {
      return tool.profiles.includes(profile);
    }
    if (profile === 'full') {
      return true;
    }
    if (tool.riskLevel === 'shell') {
      return profile === 'interactive';
    }
    if (tool.riskLevel === 'destructive' || tool.riskLevel === 'write') {
      return false;
    }
    return profile === 'minimal' ? tool.riskLevel === 'read' : tool.riskLevel === 'read' || tool.riskLevel === 'ui';
  }
}
