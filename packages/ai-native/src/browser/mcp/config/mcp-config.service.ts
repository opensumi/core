import { Autowired, Injectable } from '@opensumi/di';
import { ILogger } from '@opensumi/ide-core-browser';
import { PreferenceService } from '@opensumi/ide-core-browser/lib/preferences';
import {
  Deferred,
  Disposable,
  Emitter,
  IStorage,
  PreferenceScope,
  STORAGE_NAMESPACE,
  StorageProvider,
  localize,
} from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IMessageService } from '@opensumi/ide-overlay';

import { BUILTIN_MCP_SERVER_NAME, ISumiMCPServerBackend, SumiMCPServerProxyServicePath } from '../../../common';
import {
  MCPServerDescription,
  MCPServersEnabledKey,
  SSEMCPServerDescription,
  StdioMCPServerDescription,
} from '../../../common/mcp-server-manager';
import { MCPServer, MCP_SERVER_TYPE } from '../../../common/types';
import { MCPServerProxyService } from '../mcp-server-proxy.service';

export type MCPServerFormData = MCPServerDescription;

@Injectable()
export class MCPConfigService extends Disposable {
  @Autowired(SumiMCPServerProxyServicePath)
  private readonly sumiMCPServerBackendProxy: ISumiMCPServerBackend;

  @Autowired(MCPServerProxyService)
  private readonly mcpServerProxyService: MCPServerProxyService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  @Autowired(StorageProvider)
  private readonly storageProvider: StorageProvider;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  private chatStorage: IStorage;
  private whenReadyDeferred = new Deferred<void>();

  private readonly mcpServersChangeEventEmitter = new Emitter<boolean>();

  constructor() {
    super();

    this.init();
    this.disposables.push(
      this.mcpServerProxyService.onChangeMCPServers(() => {
        this.fireMCPServersChange();
      }),
    );
    this.disposables.push(
      this.preferenceService.onSpecificPreferenceChange('mcp', () => {
        this.fireMCPServersChange();
      }),
    );
  }

  private async init() {
    this.chatStorage = await this.storageProvider(STORAGE_NAMESPACE.CHAT);
    this.whenReadyDeferred.resolve();
  }

  get whenReady() {
    return this.whenReadyDeferred.promise;
  }

  get onMCPServersChange() {
    return this.mcpServersChangeEventEmitter.event;
  }

  fireMCPServersChange(isInit: boolean = false) {
    this.mcpServersChangeEventEmitter.fire(isInit);
  }

  async getServers(): Promise<MCPServer[]> {
    // Get workspace MCP server configurations
    const { value: mcpConfig } = this.preferenceService.resolve<{ mcpServers: Record<string, any> }>(
      'mcp',
      { mcpServers: {} },
      undefined,
    );

    if (!mcpConfig?.mcpServers || Object.keys(mcpConfig.mcpServers).length === 0) {
      const runningServers = await this.mcpServerProxyService.$getServers();
      const builtinServer = runningServers.find((server) => server.name === BUILTIN_MCP_SERVER_NAME);
      return builtinServer ? [builtinServer] : [];
    }

    const userServers = mcpConfig.mcpServers.map((server) => {
      const name = Object.keys(server)[0];
      const serverConfig = server[name];
      if (serverConfig.url) {
        return {
          name,
          type: MCP_SERVER_TYPE.SSE,
          url: serverConfig.url,
        };
      }
      return {
        name,
        type: MCP_SERVER_TYPE.STDIO,
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
      };
    });

    const runningServers = await this.mcpServerProxyService.$getServers();
    const builtinServer = runningServers.find((server) => server.name === BUILTIN_MCP_SERVER_NAME);

    // Merge server configs with running status
    const allServers = userServers.map((server) => {
      const runningServer = runningServers.find((s) => s.name === server.name);
      return {
        ...server,
        isStarted: runningServer?.isStarted || false,
        tools: runningServer?.tools || [],
      };
    }) as MCPServer[];

    // Add built-in server at the beginning if it exists
    if (builtinServer) {
      allServers.unshift(builtinServer);
    }

    return allServers;
  }

  async controlServer(serverName: string, start: boolean): Promise<void> {
    try {
      if (start) {
        await this.mcpServerProxyService.$startServer(serverName);
      } else {
        await this.mcpServerProxyService.$stopServer(serverName);
      }

      const enabledMCPServers = this.chatStorage.get<string[]>(MCPServersEnabledKey, [BUILTIN_MCP_SERVER_NAME]);
      const enabledMCPServersSet = new Set(enabledMCPServers);

      if (start) {
        enabledMCPServersSet.add(serverName);
      } else {
        enabledMCPServersSet.delete(serverName);
      }
      this.chatStorage.set(MCPServersEnabledKey, Array.from(enabledMCPServersSet));
    } catch (error) {
      const msg = error.message || error;
      this.logger.error(`Failed to ${start ? 'start' : 'stop'} server ${serverName}:`, msg);
      this.messageService.error(msg);
      throw error;
    }
  }

  async saveServer(data: MCPServerFormData): Promise<void> {
    await this.whenReady;
    const { value: mcpConfig } = this.preferenceService.resolve<{ mcpServers: Record<string, any>[] }>(
      'mcp',
      { mcpServers: [] },
      undefined,
    );
    const servers = mcpConfig!.mcpServers;
    const existingIndex = servers?.findIndex((s) => s.name === data.name);

    let serverConfig;
    if (data.type === MCP_SERVER_TYPE.SSE) {
      serverConfig = { [data.name]: { url: (data as SSEMCPServerDescription).url } };
    } else {
      serverConfig = {
        [data.name]: {
          command: (data as StdioMCPServerDescription).command,
          args: (data as StdioMCPServerDescription).args,
          env: (data as StdioMCPServerDescription).env,
        },
      };
    }
    if (existingIndex !== undefined && existingIndex >= 0) {
      servers[existingIndex] = serverConfig;
    } else {
      servers.push(serverConfig);
    }
    await this.sumiMCPServerBackendProxy.$addOrUpdateServer(data as MCPServerDescription);
    await this.preferenceService.set('mcp', { mcpServers: servers });
  }

  async deleteServer(serverName: string): Promise<void> {
    const { value: mcpConfig } = this.preferenceService.resolve<{ mcpServers: Record<string, any>[] }>(
      'mcp',
      { mcpServers: [] },
      undefined,
    );
    const servers = mcpConfig?.mcpServers;
    const serverIndex = servers?.findIndex((s) => Object.keys(s)[0] === serverName);
    if (serverIndex !== undefined && serverIndex >= 0) {
      servers?.splice(serverIndex, 1);
    }
    await this.sumiMCPServerBackendProxy.$removeServer(serverName);
    await this.preferenceService.set('mcp', { mcpServers: servers });
  }

  async syncServer(serverName: string): Promise<void> {
    await this.sumiMCPServerBackendProxy.$syncServer(serverName);
  }

  async getServerConfigByName(serverName: string): Promise<MCPServerFormData | undefined> {
    const { value: mcpConfig } = this.preferenceService.resolve<{ mcpServers: Record<string, any>[] }>(
      'mcp',
      { mcpServers: [] },
      undefined,
    );
    await this.whenReady;
    const enabledMCPServers = this.chatStorage.get<string[]>(MCPServersEnabledKey, [BUILTIN_MCP_SERVER_NAME]);
    const servers = mcpConfig?.mcpServers;
    const server = servers?.find((s) => Object.keys(s)[0] === serverName);
    if (server) {
      if (server[serverName].url) {
        return {
          name: serverName,
          type: MCP_SERVER_TYPE.SSE,
          url: server[serverName].url,
          enabled: enabledMCPServers.includes(serverName),
        };
      } else {
        return {
          name: serverName,
          type: MCP_SERVER_TYPE.STDIO,
          command: server[serverName].command,
          args: server[serverName].args,
          env: server[serverName].env,
          enabled: enabledMCPServers.includes(serverName),
        };
      }
    }
    return undefined;
  }

  getReadableServerType(type: string): string {
    switch (type) {
      case MCP_SERVER_TYPE.STDIO:
        return localize('ai.native.mcp.type.stdio');
      case MCP_SERVER_TYPE.SSE:
        return localize('ai.native.mcp.type.sse');
      case MCP_SERVER_TYPE.BUILTIN:
        return localize('ai.native.mcp.type.builtin');
      default:
        return type;
    }
  }

  async openConfigFile(): Promise<void> {
    let config = this.preferenceService.resolve<{ mcpServers: Record<string, any>[] }>(
      'mcp',
      { mcpServers: [] },
      undefined,
    );
    if (config.scope === PreferenceScope.Default) {
      await this.preferenceService.set('mcp', { mcpServers: [] }, PreferenceScope.Workspace);
      config = this.preferenceService.resolve<{ mcpServers: Record<string, any>[] }>(
        'mcp',
        { mcpServers: [] },
        undefined,
      );
    }
    const uri = config.configUri;
    if (uri) {
      this.workbenchEditorService.open(uri, {
        preview: false,
      });
    }
  }
}
