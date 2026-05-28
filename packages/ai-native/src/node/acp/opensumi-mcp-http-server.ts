import { randomBytes, randomUUID } from 'node:crypto';
import * as http from 'node:http';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { Autowired, Injectable } from '@opensumi/di';
import { ILogger } from '@opensumi/ide-core-common';
import { AcpWebMcpCallerServiceToken } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';
import { INodeLogger } from '@opensumi/ide-core-node';

import type { AcpWebMcpCallerService } from './acp-webmcp-caller.service';
import type { WebMcpGroupDef, WebMcpToolDef } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

const OPEN_SUMI_MCP_SERVER_NAME = 'opensumi-ide';
const LOOPBACK_HOST = '127.0.0.1';
const MCP_PATH_PREFIX = '/mcp/';

type ExposableWebMcpToolDef = WebMcpGroupDef['tools'][number] & {
  exposedByDefault?: boolean;
};

type WebMcpToolRiskLevel = 'read' | 'write' | 'destructive' | 'shell' | 'ui';
type WebMcpProfile = 'minimal' | 'default' | 'interactive' | 'full';

type WebMcpToolDefWithMeta = WebMcpToolDef & {
  riskLevel?: WebMcpToolRiskLevel;
  exposedByDefault?: boolean;
  profiles?: WebMcpProfile[];
};

type WebMcpGroupDefWithMeta = Omit<WebMcpGroupDef, 'tools'> & {
  profile?: WebMcpProfile;
  tools: WebMcpToolDefWithMeta[];
};

interface WebMcpSessionState {
  sessionId?: string;
  enabledGroups: Set<string>;
}

interface ResolvedWebMcpTool {
  group: WebMcpGroupDefWithMeta;
  tool: WebMcpToolDefWithMeta;
  action: string;
  name: string;
}

const CATALOG_GROUP_NAME = 'opensumi';
const CATALOG_METHOD_PREFIX = '_opensumi/capabilities/';

@Injectable()
export class OpenSumiMcpHttpServer {
  @Autowired(AcpWebMcpCallerServiceToken)
  private readonly caller: AcpWebMcpCallerService;

  @Autowired(INodeLogger)
  private readonly logger: ILogger;

  private httpServer?: http.Server;
  private readonly transports = new Map<string, StreamableHTTPServerTransport>();
  private readonly token = randomBytes(16).toString('hex');
  private port = 0;

  async start(): Promise<void> {
    if (this.httpServer) {
      return;
    }

    this.httpServer = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((err) => {
        this.logger?.error?.('[OpenSumiMcpHttpServer] Unhandled request error:', err);
        if (!res.headersSent) {
          res.writeHead(500).end(this.toErrorPayload(err));
        } else {
          res.end();
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.httpServer!.once('error', reject);
      this.httpServer!.listen(0, LOOPBACK_HOST, () => {
        this.httpServer!.off('error', reject);
        const address = this.httpServer!.address();
        if (!address || typeof address === 'string') {
          reject(new Error('[OpenSumiMcpHttpServer] Failed to determine listening port'));
          return;
        }
        this.port = address.port;
        this.logger?.log?.(`[OpenSumiMcpHttpServer] Listening on ${this.getUrl()}`);
        resolve();
      });
    });
  }

  getServerName(): string {
    return OPEN_SUMI_MCP_SERVER_NAME;
  }

  getUrl(): string {
    if (!this.port) {
      throw new Error('[OpenSumiMcpHttpServer] Server is not started');
    }
    return `http://${LOOPBACK_HOST}:${this.port}${MCP_PATH_PREFIX}${this.token}`;
  }

  async dispose(): Promise<void> {
    await Promise.all(Array.from(this.transports.values()).map((transport) => transport.close()));
    this.transports.clear();

    const server = this.httpServer;
    this.httpServer = undefined;
    this.port = 0;

    if (!server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  private createMcpServer(sessionState: WebMcpSessionState): Server {
    const server = new Server(
      {
        name: OPEN_SUMI_MCP_SERVER_NAME,
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const groupDefs = (await this.caller.getGroupDefinitions({
        includeAllTools: true,
      })) as WebMcpGroupDefWithMeta[];
      const exposedGroupDefs = this.getExposedGroupDefs(groupDefs, sessionState);
      const toolCount = groupDefs.reduce((count, group) => count + group.tools.length, 0);
      const exposedToolCount = exposedGroupDefs.reduce((count, group) => count + group.tools.length, 0);
      const toolStats = this.getToolDefinitionStats(exposedGroupDefs);
      const profileGroup = groupDefs.find((group) => (group as { profile?: string }).profile) as
        | { profile?: string }
        | undefined;
      const profile = profileGroup?.profile ?? 'unknown';
      this.logger?.log?.(
        `[OpenSumiMcpHttpServer] tools/list — profile=${profile}, groups=${groupDefs.length}, tools=${toolCount}, exposedTools=${exposedToolCount}, schemaBytes=${toolStats.totalSchemaBytes}, descriptionBytes=${toolStats.totalDescriptionBytes}, totalToolBytes=${toolStats.totalToolBytes}`,
      );
      this.logger?.log?.(
        `[OpenSumiMcpHttpServer] tools/list group bytes — ${toolStats.groups
          .map(
            (group) =>
              `${group.name}:tools=${group.toolCount},schemaBytes=${group.schemaBytes},descriptionBytes=${group.descriptionBytes},totalToolBytes=${group.totalToolBytes}`,
          )
          .join('; ')}`,
      );
      this.logger?.log?.(
        `[OpenSumiMcpHttpServer] tools/list largest tools — ${toolStats.largest
          .map(
            (tool) =>
              `${tool.name}:schemaBytes=${tool.schemaBytes},descriptionBytes=${tool.descriptionBytes},totalToolBytes=${tool.totalToolBytes}`,
          )
          .join('; ')}`,
      );
      return {
        tools: exposedGroupDefs.flatMap((group) =>
          group.tools.map((tool) => ({
            name: this.toMcpToolName(group.name, tool.method),
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        ),
      };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const groupDefs = (await this.caller.getGroupDefinitions({
          includeAllTools: true,
        })) as WebMcpGroupDefWithMeta[];
        const catalogResult = await this.handleCatalogTool(
          groupDefs,
          sessionState,
          request.params.name,
          (request.params.arguments ?? {}) as Record<string, unknown>,
        );
        if (catalogResult) {
          return catalogResult;
        }

        const target = this.resolveTool(this.getExposedGroupDefs(groupDefs, sessionState), request.params.name);
        if (!target) {
          return {
            content: [{ type: 'text', text: `Tool not found: ${request.params.name}` }],
            isError: true,
          };
        }

        const result = await this.caller.executeTool(
          target.group.name,
          target.action,
          (request.params.arguments ?? {}) as Record<string, unknown>,
        );
        this.logger?.log?.(
          `[OpenSumiMcpHttpServer] tools/call — tool=${request.params.name}, group=${target.group.name}, action=${
            target.action
          }, riskLevel=${target.tool.riskLevel ?? 'unknown'}, success=${result.success}`,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          isError: !result.success,
        };
      } catch (err) {
        this.logger?.error?.(`[OpenSumiMcpHttpServer] Tool call failed: ${request.params.name}`, err);
        return {
          content: [{ type: 'text', text: this.toErrorMessage(err) }],
          isError: true,
        };
      }
    });

    return server;
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!this.isAllowedRequest(req)) {
      res.writeHead(404).end();
      return;
    }

    let transport = this.getTransport(req);
    if (!transport && this.getSessionId(req)) {
      res.writeHead(404).end();
      return;
    }
    const createdTransport = !transport;
    if (!transport) {
      transport = await this.createTransport();
    }

    await transport.handleRequest(req, res);
    if (createdTransport && !transport.sessionId) {
      await transport.close();
    }

    const sessionId = this.getSessionId(req);
    if (req.method === 'DELETE' && sessionId) {
      this.transports.delete(sessionId);
    }
  }

  private getTransport(req: http.IncomingMessage): StreamableHTTPServerTransport | undefined {
    const sessionId = this.getSessionId(req);
    if (!sessionId) {
      return undefined;
    }
    return this.transports.get(sessionId);
  }

  private async createTransport(): Promise<StreamableHTTPServerTransport> {
    let transport: StreamableHTTPServerTransport;
    const sessionState: WebMcpSessionState = {
      enabledGroups: new Set<string>(),
    };
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (sessionId) => {
        sessionState.sessionId = sessionId;
        this.transports.set(sessionId, transport);
        this.logger?.log?.(`[OpenSumiMcpHttpServer] session initialized — sessionId=${sessionId}`);
      },
    });
    await this.createMcpServer(sessionState).connect(transport);
    return transport;
  }

  private getSessionId(req: http.IncomingMessage): string | undefined {
    const sessionId = req.headers['mcp-session-id'];
    return typeof sessionId === 'string' ? sessionId : undefined;
  }

  private isAllowedRequest(req: http.IncomingMessage): boolean {
    if (!this.isAllowedHost(req.headers.host)) {
      return false;
    }

    const url = new URL(req.url ?? '/', `http://${LOOPBACK_HOST}`);
    return url.pathname === `${MCP_PATH_PREFIX}${this.token}`;
  }

  private isAllowedHost(host?: string): boolean {
    return !host || host.startsWith(`${LOOPBACK_HOST}:`) || host.startsWith('localhost:');
  }

  private resolveTool(groupDefs: WebMcpGroupDefWithMeta[], toolName: string): ResolvedWebMcpTool | undefined {
    for (const group of groupDefs) {
      for (const tool of group.tools) {
        const action = tool.method.split('/').pop();
        if (action && this.toMcpToolName(group.name, tool.method) === toolName) {
          return { group, tool, action, name: toolName };
        }
      }
    }
    return undefined;
  }

  private toMcpToolName(groupName: string, method: string): string {
    const action = method.split('/').pop() ?? method;
    return `${groupName}_${action}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  }

  private getExposedGroupDefs(
    groupDefs: WebMcpGroupDefWithMeta[],
    sessionState: WebMcpSessionState,
  ): WebMcpGroupDefWithMeta[] {
    const exposed = groupDefs
      .map((group) => {
        const enabled = sessionState.enabledGroups.has(group.name);
        return {
          ...group,
          defaultLoaded: group.defaultLoaded || enabled,
          tools: group.tools.filter((tool) => this.isToolExposed(group, tool, enabled)),
        };
      })
      .filter((group) => group.tools.length > 0);

    return [this.getCatalogGroupDef(), ...exposed];
  }

  private isToolExposed(group: WebMcpGroupDefWithMeta, tool: WebMcpToolDefWithMeta, groupEnabled: boolean): boolean {
    if ((tool as ExposableWebMcpToolDef).exposedByDefault === false) {
      return false;
    }

    const profile = group.profile ?? 'default';
    if (groupEnabled) {
      return this.isToolAllowedAfterEnable(tool, profile);
    }

    return group.defaultLoaded && this.isToolInDefaultProfile(tool, profile);
  }

  private isToolAllowedAfterEnable(tool: WebMcpToolDefWithMeta, profile: WebMcpProfile): boolean {
    if (tool.riskLevel === 'destructive' || tool.riskLevel === 'write') {
      return profile === 'full';
    }
    if (tool.riskLevel === 'shell') {
      return profile !== 'minimal';
    }
    return true;
  }

  private isToolInDefaultProfile(tool: WebMcpToolDefWithMeta, profile: WebMcpProfile): boolean {
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

  private getCatalogGroupDef(): WebMcpGroupDefWithMeta {
    return {
      name: CATALOG_GROUP_NAME,
      description:
        'Discover and enable additional OpenSumi IDE WebMCP capability groups when the current tool list is too small.',
      defaultLoaded: true,
      tools: [
        {
          method: `${CATALOG_METHOD_PREFIX}discoverCapabilities`,
          description:
            'Discover hidden OpenSumi IDE capability groups. Call this when you need search, file read, language navigation, SCM, debug, tasks, output logs, ACP chat state, permissions, or terminal interaction tools that are not currently listed.',
          riskLevel: 'read',
          inputSchema: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: 'Short description of the current user task. Do not include secrets or file contents.',
              },
              includeDisabled: {
                type: 'boolean',
                description: 'Include groups that currently have no available tools.',
              },
            },
            additionalProperties: false,
          },
        },
        {
          method: `${CATALOG_METHOD_PREFIX}describeCapabilityGroup`,
          description:
            'Describe one OpenSumi capability group and its tools. Use includeSchemas only when you need exact parameters.',
          riskLevel: 'read',
          inputSchema: {
            type: 'object',
            properties: {
              group: {
                type: 'string',
                description:
                  'Capability group name, for example search, file, terminal, editor, diagnostics, workspace, or acp_chat.',
              },
              includeSchemas: {
                type: 'boolean',
                description: 'Return full input schemas for every tool in the group.',
              },
            },
            required: ['group'],
            additionalProperties: false,
          },
        },
        {
          method: `${CATALOG_METHOD_PREFIX}describeTool`,
          description: 'Return one OpenSumi WebMCP tool description and full input schema.',
          riskLevel: 'read',
          inputSchema: {
            type: 'object',
            properties: {
              tool: {
                type: 'string',
                description: 'MCP tool name such as search_text, or internal method such as _opensumi/search/text.',
              },
            },
            required: ['tool'],
            additionalProperties: false,
          },
        },
        {
          method: `${CATALOG_METHOD_PREFIX}enableCapabilityGroup`,
          description:
            'Enable an OpenSumi capability group for this MCP session. This only changes tool visibility; it does not execute IDE actions.',
          riskLevel: 'read',
          inputSchema: {
            type: 'object',
            properties: {
              group: {
                type: 'string',
                description: 'Capability group name to enable.',
              },
            },
            required: ['group'],
            additionalProperties: false,
          },
        },
        {
          method: `${CATALOG_METHOD_PREFIX}invokeCapabilityTool`,
          description:
            'Fallback broker for calling an enabled OpenSumi capability tool when the MCP client does not refresh tools/list after enabling a group.',
          riskLevel: 'read',
          inputSchema: {
            type: 'object',
            properties: {
              tool: {
                type: 'string',
                description: 'MCP tool name such as search_text, or internal method such as _opensumi/search/text.',
              },
              arguments: {
                type: 'object',
                description: 'Arguments for the target tool.',
                additionalProperties: true,
              },
            },
            required: ['tool'],
            additionalProperties: false,
          },
        },
      ],
    };
  }

  private async handleCatalogTool(
    groupDefs: WebMcpGroupDefWithMeta[],
    sessionState: WebMcpSessionState,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; isError: boolean } | undefined> {
    switch (toolName) {
      case 'opensumi_discoverCapabilities':
        return this.toToolResponse(this.discoverCapabilities(groupDefs, sessionState, args));
      case 'opensumi_describeCapabilityGroup':
        return this.toToolResponse(this.describeCapabilityGroup(groupDefs, args));
      case 'opensumi_describeTool':
        return this.toToolResponse(this.describeTool(groupDefs, args));
      case 'opensumi_enableCapabilityGroup':
        return this.toToolResponse(this.enableCapabilityGroup(groupDefs, sessionState, args));
      case 'opensumi_invokeCapabilityTool':
        return this.invokeCapabilityTool(groupDefs, sessionState, args);
      default:
        return undefined;
    }
  }

  private discoverCapabilities(
    groupDefs: WebMcpGroupDefWithMeta[],
    sessionState: WebMcpSessionState,
    args: Record<string, unknown>,
  ): Record<string, unknown> {
    const task = typeof args.task === 'string' ? args.task : '';
    const includeDisabled = args.includeDisabled === true;
    const recommended = this.getRecommendedGroups(groupDefs, task)
      .filter((group) => !sessionState.enabledGroups.has(group))
      .map((group) => ({
        group,
        reason: this.getRecommendationReason(group),
        nextAction: 'opensumi_enableCapabilityGroup',
        arguments: { group },
      }));
    const groups = groupDefs
      .map((group) => {
        const explicitlyEnabled = sessionState.enabledGroups.has(group.name);
        const currentTools = this.getCurrentlyExposedTools(group, sessionState);
        const toolsAfterEnable = this.getToolsAvailableAfterEnable(group);
        const defaultTools = this.getDefaultExposedTools(group);
        return {
          name: group.name,
          summary: group.description,
          whenToUse: this.getGroupWhenToUse(group.name),
          risk: this.getGroupRisk(toolsAfterEnable),
          profile: group.profile ?? 'default',
          enabled: explicitlyEnabled,
          defaultExposed: defaultTools.length > 0,
          status: explicitlyEnabled ? 'enabled' : defaultTools.length > 0 ? 'default' : 'available',
          currentlyAvailableToolCount: currentTools.length,
          defaultToolCount: defaultTools.length,
          availableAfterEnableToolCount: toolsAfterEnable.length,
          toolCount: currentTools.length,
          estimatedBytes: this.getGroupToolBytes(group.name, currentTools),
        };
      })
      .filter(
        (group) => includeDisabled || group.currentlyAvailableToolCount > 0 || group.availableAfterEnableToolCount > 0,
      );

    this.logger?.log?.(
      `[OpenSumiMcpHttpServer] capabilities/discover — sessionId=${sessionState.sessionId ?? 'unknown'}, taskChars=${
        task.length
      }, recommendedGroups=${recommended.map((item) => item.group).join(',')}, groupCount=${groups.length}`,
    );
    return { success: true, result: { recommended, groups } };
  }

  private describeCapabilityGroup(
    groupDefs: WebMcpGroupDefWithMeta[],
    args: Record<string, unknown>,
  ): Record<string, unknown> {
    const groupName = typeof args.group === 'string' ? args.group : '';
    const includeSchemas = args.includeSchemas === true;
    const group = groupDefs.find((item) => item.name === groupName);
    if (!group) {
      return { success: false, error: 'GROUP_NOT_FOUND', details: `Group "${groupName}" not found` };
    }

    const tools = this.getToolsAvailableAfterEnable(group).map((tool) => ({
      name: this.toMcpToolName(group.name, tool.method),
      method: tool.method,
      description: tool.description,
      riskLevel: tool.riskLevel ?? 'read',
      ...(includeSchemas
        ? { inputSchema: tool.inputSchema }
        : { inputSummary: this.summarizeInputSchema(tool.inputSchema) }),
    }));
    const schemaBytes = includeSchemas
      ? this.getJsonByteLength(tools.map((tool) => (tool as { inputSchema?: unknown }).inputSchema))
      : 0;
    this.logger?.log?.(
      `[OpenSumiMcpHttpServer] capabilities/describeGroup — group=${group.name}, includeSchemas=${includeSchemas}, schemaBytes=${schemaBytes}`,
    );
    return {
      success: true,
      result: {
        group: group.name,
        summary: group.description,
        whenToUse: this.getGroupWhenToUse(group.name),
        toolCount: tools.length,
        tools,
      },
    };
  }

  private describeTool(groupDefs: WebMcpGroupDefWithMeta[], args: Record<string, unknown>): Record<string, unknown> {
    const toolName = typeof args.tool === 'string' ? args.tool : '';
    const target = this.resolveAnyTool(groupDefs, toolName);
    if (!target) {
      return { success: false, error: 'TOOL_NOT_FOUND', details: `Tool "${toolName}" not found` };
    }

    const schemaBytes = this.getJsonByteLength(target.tool.inputSchema);
    this.logger?.log?.(
      `[OpenSumiMcpHttpServer] capabilities/describeTool — tool=${target.name}, schemaBytes=${schemaBytes}`,
    );
    return {
      success: true,
      result: {
        name: target.name,
        method: target.tool.method,
        group: target.group.name,
        description: target.tool.description,
        riskLevel: target.tool.riskLevel ?? 'read',
        inputSchema: target.tool.inputSchema,
      },
    };
  }

  private enableCapabilityGroup(
    groupDefs: WebMcpGroupDefWithMeta[],
    sessionState: WebMcpSessionState,
    args: Record<string, unknown>,
  ): Record<string, unknown> {
    const groupName = typeof args.group === 'string' ? args.group : '';
    const group = groupDefs.find((item) => item.name === groupName);
    if (!group) {
      return { success: false, error: 'GROUP_NOT_FOUND', details: `Group "${groupName}" not found` };
    }
    sessionState.enabledGroups.add(group.name);
    const firstTool = this.getToolsAvailableAfterEnable(group)[0];
    this.logger?.log?.(
      `[OpenSumiMcpHttpServer] capabilities/enableGroup — sessionId=${sessionState.sessionId ?? 'unknown'}, group=${
        group.name
      }, enabledGroups=${Array.from(sessionState.enabledGroups).join(',')}`,
    );
    return {
      success: true,
      result: {
        enabled: true,
        group: group.name,
        enabledGroups: Array.from(sessionState.enabledGroups),
        refreshRequired: true,
        fallbackTool: 'opensumi_invokeCapabilityTool',
        example: firstTool
          ? {
              tool: 'opensumi_invokeCapabilityTool',
              arguments: {
                tool: this.toMcpToolName(group.name, firstTool.method),
                arguments: {},
              },
            }
          : undefined,
      },
    };
  }

  private async invokeCapabilityTool(
    groupDefs: WebMcpGroupDefWithMeta[],
    sessionState: WebMcpSessionState,
    args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; isError: boolean }> {
    const toolName = typeof args.tool === 'string' ? args.tool : '';
    const target = this.resolveAnyTool(groupDefs, toolName);
    if (!target) {
      return this.toToolResponse({ success: false, error: 'TOOL_NOT_FOUND', details: `Tool "${toolName}" not found` });
    }

    const groupEnabled = sessionState.enabledGroups.has(target.group.name);
    if (!this.isToolExposed(target.group, target.tool, groupEnabled)) {
      return this.toToolResponse({
        success: false,
        error: 'CAPABILITY_NOT_ENABLED',
        details: `Enable group "${target.group.name}" with opensumi_enableCapabilityGroup before invoking "${target.name}".`,
      });
    }

    const toolArgs = this.asRecord(args.arguments);
    const result = await this.caller.executeTool(target.group.name, target.action, toolArgs);
    this.logger?.log?.(
      `[OpenSumiMcpHttpServer] capabilities/invokeTool — tool=${target.name}, group=${target.group.name}, riskLevel=${
        target.tool.riskLevel ?? 'unknown'
      }, success=${result.success}`,
    );
    return this.toToolResponse(result as unknown as Record<string, unknown>);
  }

  private resolveAnyTool(groupDefs: WebMcpGroupDefWithMeta[], toolName: string): ResolvedWebMcpTool | undefined {
    for (const group of groupDefs) {
      for (const tool of group.tools) {
        const action = tool.method.split('/').pop();
        const mcpName = this.toMcpToolName(group.name, tool.method);
        if (action && (mcpName === toolName || tool.method === toolName)) {
          return { group, tool, action, name: mcpName };
        }
      }
    }
    return undefined;
  }

  private getToolsAvailableAfterEnable(group: WebMcpGroupDefWithMeta): WebMcpToolDefWithMeta[] {
    const profile = group.profile ?? 'default';
    return group.tools.filter(
      (tool) =>
        (tool as ExposableWebMcpToolDef).exposedByDefault !== false && this.isToolAllowedAfterEnable(tool, profile),
    );
  }

  private getCurrentlyExposedTools(
    group: WebMcpGroupDefWithMeta,
    sessionState: WebMcpSessionState,
  ): WebMcpToolDefWithMeta[] {
    const enabled = sessionState.enabledGroups.has(group.name);
    return group.tools.filter((tool) => this.isToolExposed(group, tool, enabled));
  }

  private getDefaultExposedTools(group: WebMcpGroupDefWithMeta): WebMcpToolDefWithMeta[] {
    if (!group.defaultLoaded) {
      return [];
    }
    return group.tools.filter(
      (tool) =>
        (tool as ExposableWebMcpToolDef).exposedByDefault !== false &&
        this.isToolInDefaultProfile(tool, group.profile ?? 'default'),
    );
  }

  private getRecommendedGroups(groupDefs: WebMcpGroupDefWithMeta[], task: string): string[] {
    const lowerTask = task.toLowerCase();
    const candidates: string[] = [];
    const add = (group: string) => {
      if (groupDefs.some((item) => item.name === group) && !candidates.includes(group)) {
        candidates.push(group);
      }
    };

    if (/search|find|grep|symbol|reference|查找|搜索|引用|符号/.test(lowerTask)) {
      add('search');
    }
    if (/file|path|read|stat|文件|路径|目录/.test(lowerTask)) {
      add('file');
    }
    if (/terminal|shell|command|process|进程|终端|命令|交互/.test(lowerTask)) {
      add('terminal');
    }
    if (/diagnostic|problem|error|warning|报错|问题|诊断/.test(lowerTask)) {
      add('diagnostics');
    }
    if (/editor|selection|buffer|dirty|diff|编辑器|选区|未保存/.test(lowerTask)) {
      add('editor');
    }
    if (/acp|chat|session|permission|agent status|聊天|会话|权限|许可|智能体状态/.test(lowerTask)) {
      add('acp_chat');
    }
    return candidates;
  }

  private getRecommendationReason(group: string): string {
    const reasons: Record<string, string> = {
      search: 'Task appears to need workspace-wide lookup or symbol discovery.',
      file: 'Task appears to need IDE-side file metadata or file reads.',
      terminal: 'Task appears to need observing or interacting with an IDE terminal.',
      diagnostics: 'Task appears to need IDE diagnostics or problem navigation.',
      editor: 'Task appears to need active editor, selection, dirty buffer, or diff context.',
      acp_chat: 'Task appears to need ACP chat session state or permission status.',
    };
    return reasons[group] ?? `Task may need the ${group} OpenSumi capability group.`;
  }

  private getGroupWhenToUse(group: string): string {
    const hints: Record<string, string> = {
      workspace: 'Use for current workspace roots, open files, and window context.',
      search: 'Use when the exact file path, text location, or symbol location is unknown.',
      diagnostics: 'Use when you need IDE/LSP problems, error stats, or to open a diagnostic.',
      file: 'Use for IDE-side file reads and metadata when shell/filesystem context is insufficient.',
      terminal:
        'Use to observe existing IDE terminals, read recent output, tail long-running processes, or interact when enabled by profile.',
      editor: 'Use for active editor, selection, unsaved buffers, dirty diffs, and editor UI navigation.',
      acp_chat:
        'Use for ACP chat session metadata, thread status, permission dialog counts, and showing the chat panel.',
    };
    return hints[group] ?? `Use for OpenSumi ${group} IDE capability.`;
  }

  private getGroupRisk(tools: WebMcpToolDefWithMeta[]): WebMcpToolRiskLevel {
    const order: WebMcpToolRiskLevel[] = ['read', 'ui', 'write', 'shell', 'destructive'];
    return tools.reduce<WebMcpToolRiskLevel>((max, tool) => {
      const risk = tool.riskLevel ?? 'read';
      return order.indexOf(risk) > order.indexOf(max) ? risk : max;
    }, 'read');
  }

  private summarizeInputSchema(schema: Record<string, unknown>): Record<string, unknown> {
    const properties = this.asRecord(schema.properties);
    const required = Array.isArray(schema.required) ? schema.required.filter((item) => typeof item === 'string') : [];
    return {
      required,
      properties: Object.entries(properties).map(([name, value]) => ({
        name,
        type: this.asRecord(value).type ?? 'unknown',
      })),
    };
  }

  private getGroupToolBytes(groupName: string, tools: WebMcpToolDefWithMeta[]): number {
    return tools.reduce(
      (total, tool) =>
        total +
        this.getJsonByteLength({
          name: this.toMcpToolName(groupName, tool.method),
          description: tool.description,
          inputSchema: tool.inputSchema,
        }),
      0,
    );
  }

  private toToolResponse(result: Record<string, unknown>): {
    content: Array<{ type: 'text'; text: string }>;
    isError: boolean;
  } {
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      isError: result.success === false,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private getToolDefinitionStats(groupDefs: WebMcpGroupDefWithMeta[]): {
    totalSchemaBytes: number;
    totalDescriptionBytes: number;
    totalToolBytes: number;
    groups: Array<{
      name: string;
      toolCount: number;
      schemaBytes: number;
      descriptionBytes: number;
      totalToolBytes: number;
    }>;
    largest: Array<{ name: string; schemaBytes: number; descriptionBytes: number; totalToolBytes: number }>;
  } {
    const largest: Array<{ name: string; schemaBytes: number; descriptionBytes: number; totalToolBytes: number }> = [];
    const groups = groupDefs.map((group) => {
      const stats = group.tools.reduce(
        (total, tool) => {
          const schemaBytes = this.getJsonByteLength(tool.inputSchema);
          const descriptionBytes = this.getStringByteLength(tool.description);
          const totalToolBytes = this.getJsonByteLength({
            name: this.toMcpToolName(group.name, tool.method),
            description: tool.description,
            inputSchema: tool.inputSchema,
          });
          total.schemaBytes += schemaBytes;
          total.descriptionBytes += descriptionBytes;
          total.totalToolBytes += totalToolBytes;
          largest.push({
            name: this.toMcpToolName(group.name, tool.method),
            schemaBytes,
            descriptionBytes,
            totalToolBytes,
          });
          return total;
        },
        { schemaBytes: 0, descriptionBytes: 0, totalToolBytes: 0 },
      );
      return {
        name: group.name,
        toolCount: group.tools.length,
        ...stats,
      };
    });

    return {
      totalSchemaBytes: groups.reduce((total, group) => total + group.schemaBytes, 0),
      totalDescriptionBytes: groups.reduce((total, group) => total + group.descriptionBytes, 0),
      totalToolBytes: groups.reduce((total, group) => total + group.totalToolBytes, 0),
      groups,
      largest: largest.sort((a, b) => b.totalToolBytes - a.totalToolBytes).slice(0, 5),
    };
  }

  private getStringByteLength(value: string): number {
    return Buffer.byteLength(value, 'utf8');
  }

  private getJsonByteLength(value: unknown): number {
    return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
  }

  private toErrorPayload(err: unknown): string {
    return JSON.stringify({ error: this.toErrorMessage(err) });
  }

  private toErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
