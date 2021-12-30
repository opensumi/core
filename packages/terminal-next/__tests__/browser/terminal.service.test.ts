import { ITerminalService, ITerminalInternalService, ITerminalServicePath } from '../../src/common';
import { NodePtyTerminalService } from '../../src/browser/terminal.service';
import os from 'os';
import { injector } from './inject';
import WebSocket from 'ws';
import httpProxy from 'http-proxy';
import { Disposable, FileUri, URI } from '@opensumi/ide-core-common';
import { createProxyServer, createWsServer, resetPort } from './proxy';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import path from 'path';
import * as fs from 'fs-extra';
import { EnvironmentVariableServiceToken } from '@opensumi/ide-terminal-next/lib/common/environmentVariable';

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
  let launchConfig: any;
  beforeAll(async () => {
    root = FileUri.create(path.join(os.tmpdir(), 'terminal-service-test'));

    await fs.ensureDir(root.path.toString());

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

    injector.overrideProviders({
      token: ITerminalService,
      useClass: NodePtyTerminalService,
    });

    injector.addProviders({
      token: ITerminalServicePath,
      useValue: {
        create2: (_, c) => {
          launchConfig = c;
        },
        $resolveUnixShellPath(p) {
          return p;
        },
        $resolvePotentialUnixShellPath() {
          return 'detectedBash';
        },
      },
    });
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

  it('should be valid launchConfig with a valid shell path and ignore type', async () => {
    if ((await terminalService.getOs()) !== 1) {
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
      expect(launchConfig.shellPath).toEqual(shellPath);
    }
  });
  it('should be valid launchConfig with empty type or default', async () => {
    if ((await terminalService.getOs()) !== 1) {
      await terminalService.attach(sessionId, {} as any, 200, 200, {}, '');
      expect(launchConfig.shellPath).toEqual('detectedBash');
      await terminalService.attach(sessionId, {} as any, 200, 200, {}, 'default');
      expect(launchConfig.shellPath).toEqual('detectedBash');
    }
  });

  it('should be valid launchConfig with specific type', async () => {
    if ((await terminalService.getOs()) !== 1) {
      await terminalService.attach(sessionId, {} as any, 200, 200, {}, 'bash');
      expect(launchConfig.shellPath).toEqual('bash');
      await terminalService.attach(sessionId, {} as any, 200, 200, {}, 'asdasdasdasd');
      expect(launchConfig.shellPath).toEqual('asdasdasdasd');
    }
  });
});
