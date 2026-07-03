import { HideReason } from '@opensumi/ide-core-browser';
import { AINativeSettingSectionsId, URI } from '@opensumi/ide-core-common';

describe('DefaultACPConfigProvider', () => {
  interface ProviderFixtureOptions {
    webMcpEnabled?: boolean;
    isMultiRoot?: boolean;
    quickPickResult?: string | undefined | Promise<string | undefined>;
  }

  const rootA = '/workspace/root-a';
  const rootB = '/workspace/root-b';

  async function createProvider(options: ProviderFixtureOptions = {}) {
    let provider!: import('../../../src/browser/chat/default-acp-config-provider').DefaultACPConfigProvider & {
      preferenceService: {
        get: jest.Mock;
      };
      workspaceService: {
        whenReady: Promise<void>;
        isMultiRootWorkspaceOpened: boolean;
        tryGetRoots: jest.Mock;
        workspace?: { uri: string };
      };
      quickPick: {
        show: jest.Mock;
        hide: jest.Mock;
      };
      messageService: {
        info: jest.Mock;
      };
      mcpConfigService: {
        getACPServers: jest.Mock;
        isBuiltinMCPEnabled: jest.Mock;
      };
    };

    await jest.isolateModulesAsync(async () => {
      const { DefaultACPConfigProvider } = await import('../../../src/browser/chat/default-acp-config-provider');
      const isMultiRoot = options.isMultiRoot ?? false;
      const roots = [rootA, rootB].map((root) => ({ uri: URI.file(root).toString() }));
      const quickPickResult =
        'quickPickResult' in options ? options.quickPickResult : options.isMultiRoot ? rootB : undefined;

      provider = Object.create(DefaultACPConfigProvider.prototype);

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
        workspaceService: {
          value: {
            whenReady: Promise.resolve(),
            isMultiRootWorkspaceOpened: isMultiRoot,
            tryGetRoots: jest.fn(() => roots),
            workspace: { uri: URI.file(rootA).toString() },
          },
        },
        quickPick: {
          value: {
            show: jest.fn(() => Promise.resolve(quickPickResult)),
            hide: jest.fn(),
          },
        },
        messageService: {
          value: {
            info: jest.fn(),
          },
        },
        mcpConfigService: {
          value: {
            getACPServers: jest.fn().mockResolvedValue([]),
            isBuiltinMCPEnabled: jest.fn().mockResolvedValue(options.webMcpEnabled ?? false),
          },
        },
      });
    });

    return provider;
  }

  it('uses unified built-in MCP state for ACP WebMCP exposure', async () => {
    const provider = await createProvider({ webMcpEnabled: false });

    const config = await provider.resolveConfig();

    expect((provider as any).mcpConfigService.isBuiltinMCPEnabled).toHaveBeenCalled();
    expect((provider as any).mcpConfigService.getACPServers).toHaveBeenCalled();
    expect(config.webMcp).toEqual({ enabled: false });
    expect(config.cwd).toBe(rootA);
  });

  it('uses the selected multi-root workspace directory for ACP cwd', async () => {
    const provider = await createProvider({
      isMultiRoot: true,
      quickPickResult: rootB,
    });

    const config = await provider.resolveConfig();

    expect(config.cwd).toBe(rootB);
    expect((provider as any).quickPick.show).toHaveBeenCalledWith([rootA, rootB], expect.any(Object));
    expect((provider as any).messageService.info).not.toHaveBeenCalled();
  });

  it('falls back to the first multi-root workspace directory when QuickPick is cancelled', async () => {
    const provider = await createProvider({
      isMultiRoot: true,
      quickPickResult: undefined,
    });

    const config = await provider.resolveConfig();
    const cachedConfig = await provider.resolveConfig();

    expect(config.cwd).toBe(rootA);
    expect(cachedConfig.cwd).toBe(rootA);
    expect((provider as any).quickPick.show).toHaveBeenCalledTimes(1);
    expect((provider as any).messageService.info).toHaveBeenCalledTimes(1);
  });

  it('falls back to the first multi-root workspace directory when QuickPick never resolves', async () => {
    jest.useFakeTimers();

    try {
      const provider = await createProvider({
        isMultiRoot: true,
        quickPickResult: new Promise<string | undefined>(() => {}),
      });

      const configPromise = provider.resolveConfig();

      await jest.advanceTimersByTimeAsync(3000);

      await expect(configPromise).resolves.toMatchObject({ cwd: rootA });
      expect((provider as any).quickPick.hide).toHaveBeenCalledWith(HideReason.CANCELED);
      expect((provider as any).messageService.info).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
