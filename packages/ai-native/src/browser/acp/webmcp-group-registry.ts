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
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /**
   * Risk metadata is used for discovery, logging, and future policy tuning.
   * It does not replace permission checks inside the concrete tool handler.
   */
  riskLevel?: WebMcpToolRiskLevel;
  /**
   * Temporary visibility escape hatch for tools that should not enter the
   * ordinary MCP tool surface while the capability set is being validated.
   */
  exposedByDefault?: boolean;
  /**
   * Profile metadata controls the default browser-side catalog surface.
   * The HTTP MCP server can request includeAllTools and apply session-level
   * visibility rules for catalog enablement.
   */
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
        // By default this registry returns the profile-sized tool surface.
        // HTTP MCP catalog discovery asks for includeAllTools so it can expose
        // hidden groups lazily per MCP session without changing this registry.
        .filter((t) => options?.includeAllTools || this.isToolInProfile(t, profile))
        .map((t) => ({
          name: t.name,
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

  executeTool(groupName: string, toolName: string, params: Record<string, unknown>): Promise<WebMcpToolResult> {
    const group = this.groups.get(groupName);
    if (!group) {
      return Promise.resolve({
        success: false,
        error: 'TOOL_NOT_FOUND',
        details: `Group "${groupName}" not found`,
      });
    }
    const tool = group.tools.find((t) => t.name === toolName);
    if (!tool) {
      return Promise.resolve({
        success: false,
        error: 'TOOL_NOT_FOUND',
        details: `Tool "${toolName}" not found in group "${groupName}"`,
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
