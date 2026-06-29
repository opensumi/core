import { AINativeSettingSectionsId } from '@opensumi/ide-core-common';

import { WebMcpGroupRegistry } from '../../src/browser/acp/webmcp-group-registry';
import { MCPConfigService } from '../../src/browser/mcp/config/mcp-config.service';
import { BUILTIN_MCP_SERVER_NAME } from '../../src/common';
import { MCPServersDisabledKey } from '../../src/common/mcp-server-manager';

import type { WebMcpProfile } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

function createStorage(initial: Record<string, unknown> = {}) {
  const data = { ...initial };
  return {
    data,
    get: jest.fn((key: string, defaultValue: unknown) => (key in data ? data[key] : defaultValue)),
    set: jest.fn((key: string, value: unknown) => {
      data[key] = value;
    }),
  };
}

function createService(
  options: {
    disabledServers?: string[];
    webMcpEnabled?: boolean;
    webMcpProfile?: WebMcpProfile;
    webMcpGroupRegistry?: WebMcpGroupRegistry;
  } = {},
) {
  const preferences: Record<string, unknown> = {
    [AINativeSettingSectionsId.WebMcpEnabled]: options.webMcpEnabled ?? true,
    [AINativeSettingSectionsId.WebMcpProfile]: options.webMcpProfile ?? 'default',
  };
  const chatStorage = createStorage({
    [MCPServersDisabledKey]: options.disabledServers ?? [],
  });
  const preferenceService = {
    get: jest.fn((id: string, fallback: unknown) => (id in preferences ? preferences[id] : fallback)),
    set: jest.fn(async (id: string, value: unknown) => {
      preferences[id] = value;
    }),
  };
  const service = Object.create(MCPConfigService.prototype) as MCPConfigService & {
    whenReadyDeferred: { promise: Promise<void> };
    mcpServerProxyService: {
      $startServer: jest.Mock;
      $stopServer: jest.Mock;
    };
    preferenceService: typeof preferenceService;
    chatStorage: ReturnType<typeof createStorage>;
    logger: { error: jest.Mock };
    messageService: { error: jest.Mock };
    mcpServersChangeEventEmitter: { fire: jest.Mock };
    webMcpGroupRegistry: WebMcpGroupRegistry;
  };

  Object.defineProperties(service, {
    whenReadyDeferred: { value: { promise: Promise.resolve() } },
    mcpServerProxyService: {
      value: {
        $startServer: jest.fn().mockResolvedValue(undefined),
        $stopServer: jest.fn().mockResolvedValue(undefined),
      },
    },
    preferenceService: { value: preferenceService },
    chatStorage: { value: chatStorage },
    logger: { value: { error: jest.fn() } },
    messageService: { value: { error: jest.fn() } },
    mcpServersChangeEventEmitter: { value: { fire: jest.fn() } },
    webMcpGroupRegistry: {
      value:
        options.webMcpGroupRegistry ??
        ({
          getGroupDefinitions: jest.fn(() => []),
        } as unknown as WebMcpGroupRegistry),
    },
  });

  return {
    service,
    preferences,
    preferenceService,
    chatStorage,
    proxy: (service as any).mcpServerProxyService,
  };
}

describe('MCPConfigService unified built-in MCP management', () => {
  it('disables traditional Builtin MCP and WebMCP together', async () => {
    const { service, chatStorage, preferenceService, proxy } = createService();

    await service.setBuiltinMCPEnabled(false);

    expect(proxy.$stopServer).toHaveBeenCalledWith(BUILTIN_MCP_SERVER_NAME);
    expect(chatStorage.data[MCPServersDisabledKey]).toContain(BUILTIN_MCP_SERVER_NAME);
    expect(preferenceService.set).toHaveBeenCalledWith(AINativeSettingSectionsId.WebMcpEnabled, false);
  });

  it('enables traditional Builtin MCP and WebMCP together', async () => {
    const { service, chatStorage, preferenceService, proxy } = createService({
      disabledServers: [BUILTIN_MCP_SERVER_NAME],
      webMcpEnabled: false,
    });

    await service.setBuiltinMCPEnabled(true);

    expect(proxy.$startServer).toHaveBeenCalledWith(BUILTIN_MCP_SERVER_NAME);
    expect(chatStorage.data[MCPServersDisabledKey]).not.toContain(BUILTIN_MCP_SERVER_NAME);
    expect(preferenceService.set).toHaveBeenCalledWith(AINativeSettingSectionsId.WebMcpEnabled, true);
  });

  it('treats Builtin as disabled when either stored server state or WebMCP preference is disabled', async () => {
    await expect(
      createService({
        disabledServers: [BUILTIN_MCP_SERVER_NAME],
        webMcpEnabled: true,
      }).service.isBuiltinMCPEnabled(),
    ).resolves.toBe(false);

    await expect(
      createService({
        disabledServers: [],
        webMcpEnabled: false,
      }).service.isBuiltinMCPEnabled(),
    ).resolves.toBe(false);
  });

  it('updates WebMCP profile and reflects the registry profile-sized groups', async () => {
    const preferences: Record<string, unknown> = {
      [AINativeSettingSectionsId.WebMcpProfile]: 'default',
    };
    const previousUrl = window.location.href;
    window.history.pushState({}, '', '/');
    const registry = new WebMcpGroupRegistry();
    Object.defineProperty(registry, 'preferenceService', {
      value: {
        get: jest.fn((id: string, fallback: unknown) => (id in preferences ? preferences[id] : fallback)),
      },
      writable: true,
    });
    registry.registerGroup({
      name: 'terminal',
      description: 'Terminal capabilities',
      defaultLoaded: true,
      tools: [
        {
          name: 'terminal_read_output',
          description: 'Read terminal output',
          riskLevel: 'read',
          inputSchema: {},
          execute: jest.fn(),
        },
        {
          name: 'terminal_run_command',
          description: 'Run terminal command',
          riskLevel: 'shell',
          profiles: ['interactive', 'full'],
          inputSchema: {},
          execute: jest.fn(),
        },
      ],
    });

    try {
      const { service, preferenceService } = createService({
        webMcpProfile: 'default',
        webMcpGroupRegistry: registry,
      });
      preferenceService.set.mockImplementation(async (id: string, value: unknown) => {
        preferences[id] = value;
      });

      expect(service.getWebMcpGroups()).toEqual([
        {
          name: 'terminal',
          description: 'Terminal capabilities',
          defaultLoaded: true,
          toolCount: 1,
        },
      ]);

      await service.setWebMcpProfile('interactive');

      expect(preferenceService.set).toHaveBeenCalledWith(AINativeSettingSectionsId.WebMcpProfile, 'interactive');
      expect(service.getWebMcpGroups()[0].toolCount).toBe(2);
    } finally {
      window.history.pushState({}, '', previousUrl);
    }
  });
});
