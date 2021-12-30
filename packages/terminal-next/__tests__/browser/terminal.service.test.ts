import { ITerminalService, ITerminalInternalService } from '../../src/common';
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
  let terminalInternalService: ITerminalInternalService;
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
  });

  afterAll(() => {
    server.close();
    proxy.close();
    injector.disposeAll();
  });

  beforeEach(() => {
    terminalInternalService = injector.get(ITerminalInternalService);
    terminalService = injector.get(ITerminalService);
  });

  it('should create with a valid shell path and ignore type', async () => {
    const connection = await terminalInternalService.attach(
      sessionId,
      {} as any,
      200,
      200,
      {
        shellPath,
      },
      'asdasd',
    );
    expect(connection).toBeTruthy();
  });
});
