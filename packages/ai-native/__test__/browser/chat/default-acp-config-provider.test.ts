import { AINativeSettingSectionsId } from '@opensumi/ide-core-common';

import { DefaultACPConfigProvider } from '../../../src/browser/chat/default-acp-config-provider';
import { pickWorkspaceDir } from '../../../src/browser/chat/pick-workspace-dir';

jest.mock('../../../src/browser/chat/pick-workspace-dir', () => ({
  pickWorkspaceDir: jest.fn().mockResolvedValue('/workspace'),
}));

describe('DefaultACPConfigProvider', () => {
  function createProvider(webMcpEnabled: boolean) {
    const provider = Object.create(DefaultACPConfigProvider.prototype) as DefaultACPConfigProvider & {
      preferenceService: {
        get: jest.Mock;
      };
      workspaceService: {
        whenReady: Promise<void>;
      };
      quickPick: Record<string, unknown>;
      messageService: Record<string, unknown>;
      mcpConfigService: {
        getACPServers: jest.Mock;
        isBuiltinMCPEnabled: jest.Mock;
      };
    };

    Object.defineProperties(provider, {
      preferenceService: {
        value: {
          get: jest.fn((id: string, fallback: unknown) => {
            if (id === AINativeSettingSectionsId.DefaultAgentType) {
              return 'claude-agent-acp';
            }
            if (id === AINativeSettingSectionsId.AgentConfigs) {
              return {};
            }
            if (id === 'ai-native.acp.nodePath') {
              return '';
            }
            if (id === 'ai-native.acp.agents') {
              return {};
            }
            if (id === AINativeSettingSectionsId.AcpThreadPoolSize) {
              return fallback;
            }
            return fallback;
          }),
        },
      },
      workspaceService: { value: { whenReady: Promise.resolve() } },
      quickPick: { value: {} },
      messageService: { value: {} },
      mcpConfigService: {
        value: {
          getACPServers: jest.fn().mockResolvedValue([]),
          isBuiltinMCPEnabled: jest.fn().mockResolvedValue(webMcpEnabled),
        },
      },
    });

    return provider;
  }

  it('uses unified built-in MCP state for ACP WebMCP exposure', async () => {
    const provider = createProvider(false);

    const config = await provider.resolveConfig();

    expect((provider as any).mcpConfigService.isBuiltinMCPEnabled).toHaveBeenCalled();
    expect((provider as any).mcpConfigService.getACPServers).toHaveBeenCalled();
    expect(config.webMcp).toEqual({ enabled: false });
    expect(pickWorkspaceDir).toHaveBeenCalled();
  });
});
