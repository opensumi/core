import os from 'os';
import path from 'path';
import fse from 'fs-extra';
import WebSocket from 'ws';
import httpProxy from 'http-proxy';
import { AppConfig } from '@opensumi/ide-core-browser';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { Disposable, FileUri, URI } from '@opensumi/ide-core-common';
import { OperatingSystem } from '@opensumi/ide-core-common/lib/platform';
import { EnvironmentVariableServiceToken } from '@opensumi/ide-terminal-next/lib/common/environmentVariable';

import { injector } from './inject';
import { createProxyServer, createWsServer, resetPort } from './proxy';
import { IShellLaunchConfig, ITerminalService, ITerminalServicePath } from '../../src/common';
import { NodePtyTerminalService } from '../../src/browser/terminal.service';

describe('terminal service test cases', () => {
  let terminalService: ITerminalService;
  const sessionId = 'test-session-id';
  let shellPath = '';

  if (os.platform() === 'win32') {
    shellPath = 'powershell';
  } else if (os.platform() === 'linux' || os.platform() === 'darwin') {
    shellPath = 'sh';
  }

  let proxy: httpProxy;
  let server: WebSocket.Server;
  let workspaceService: IWorkspaceService;
  let root: URI | null;
  let launchConfig: IShellLaunchConfig | undefined;
  beforeAll(async () => {
    root = FileUri.create(path.join(os.tmpdir(), 'terminal-service-test'));

    await fse.ensureDir(root.path.toString());

    workspaceService = injector.get(IWorkspaceService);

    injector.addProviders({
      token: EnvironmentVariableServiceToken,
      useValue: {
        mergedCollection: undefined,
        onDidChangeCollections: () => Disposable.NULL,
      },
    });

    await workspaceService.setWorkspace({
      uri: root.toString(),
      lastModification: new Date().getTime(),
      isDirectory: true,
    });
    resetPort();

    server = createWsServer();
    proxy = createProxyServer();

    injector.overrideProviders(
      {
        token: ITerminalService,
        useClass: NodePtyTerminalService,
      },
      {
        token: AppConfig,
        useValue: {
          isElectronRenderer: true,
          isRemote: false,
        },
      },
    );

    injector.overrideProviders({
      token: ITerminalServicePath,
      useValue: {
        getCodePlatformKey() {
          return 'osx';
        },
        getDefaultSystemShell() {
          return '/bin/sh';
        },
        getOs() {
          return OperatingSystem.Macintosh;
        },
        detectAvailableProfiles() {
          return [];
        },
        create2: (sessionId, cols, rows, _launchConfig) => {
          launchConfig = _launchConfig;
        },
        $resolveUnixShellPath(p) {
          return p;
        },
        $resolvePotentialUnixShellPath() {
          return 'detectedBash';
        },
      },
    });

    // electronEnv 在环境中就是 global
    (global as any).metadata = {
      windowClientId: 'test-window-client-id',
    };
  });

  afterAll(() => {
    server.close();
    proxy.close();
    injector.disposeAll();
  });

  beforeEach(() => {
    terminalService = injector.get(ITerminalService);
  });

  afterEach(() => {
    launchConfig = undefined;
  });
  it('should be generate a session id', async () => {
    const windowClientId = await terminalService.generateSessionId?.();
    expect(windowClientId).toMatch(/^test-window-client-id.*/);
  });

  it('[attach] should be valid launchConfig with a valid shell path and ignore type', async () => {
    await terminalService.attach(
      sessionId,
      {} as any,
      200,
      200,
      {
        shellPath,
      },
      'asdasd',
    );
    expect(launchConfig?.executable).toEqual(shellPath);
  });
  it('[attach] should be valid launchConfig with empty type or default', async () => {
    await terminalService.attach(sessionId, {} as any, 200, 200, {}, '');
    expect(launchConfig?.executable).toEqual('detectedBash');
    await terminalService.attach(sessionId, {} as any, 200, 200, {}, 'default');
    expect(launchConfig?.executable).toEqual('detectedBash');
  });

  it('[attach] should be valid launchConfig with specific type', async () => {
    await terminalService.attach(sessionId, {} as any, 200, 200, {}, 'bash');
    expect(launchConfig?.executable).toEqual('bash');
    await terminalService.attach(sessionId, {} as any, 200, 200, {}, 'asdasdasdasd');
    expect(launchConfig?.executable).toEqual('asdasdasdasd');
  });

  it('[attachByLaunchConfig] can launch valid config', async () => {
    const launchConfig: IShellLaunchConfig = {
      executable: shellPath,
    };
    await terminalService.attachByLaunchConfig(sessionId, 200, 200, launchConfig);
    expect(launchConfig?.executable).toEqual(shellPath);
  });
});
