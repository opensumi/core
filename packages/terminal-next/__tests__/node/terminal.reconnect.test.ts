import os from 'os';

import { Injector } from '@opensumi/di';
import { Emitter, Event } from '@opensumi/ide-core-common';
import { AppConfig } from '@opensumi/ide-core-node';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/mock-injector';

import { IShellLaunchConfig, ITerminalNodeService, ITerminalServiceClient } from '../../src/common';
import { IPtyProcessProxy } from '../../src/common/pty';
import { TerminalNodePtyModule } from '../../src/node';
import { PtyService } from '../../src/node/pty';
import { IPtyServiceManager, PtyServiceManagerToken } from '../../src/node/pty.manager';

class MockPtyServiceManager implements IPtyServiceManager {
  private reconnectEmitter = new Emitter<void>();
  private disconnectEmitter = new Emitter<void>();
  onDidReconnect: Event<void> = this.reconnectEmitter.event;
  onDidDisconnect: Event<void> = this.disconnectEmitter.event;

  fireReconnect() {
    this.reconnectEmitter.fire();
  }
  fireDisconnect() {
    this.disconnectEmitter.fire();
  }

  // Unused in these tests
  spawn(): Promise<IPtyProcessProxy> {
    throw new Error('not implemented');
  }
  onData(): any {}
  onExit(): any {}
  resize(): void {}
  write(): void {}
  pause(): void {}
  resume(): void {}
  clear(): void {}
  kill(): void {}
  getProcess(): Promise<string> {
    return Promise.resolve('');
  }
  getCwd(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }
  checkSession(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

class FakePtyService extends PtyService {
  static instances: FakePtyService[] = [];
  started = false;
  private fakePty: IPtyProcessProxy;

  constructor(id: string, launchConfig: IShellLaunchConfig, cols: number, rows: number) {
    super(id, launchConfig, cols, rows);
    this.fakePty = {
      pid: Math.floor(Math.random() * 10000) + 1,
      cols,
      rows,
      process: launchConfig.executable || '',
      parsedName: '',
      bin: '',
      launchConfig,
      handleFlowControl: false,
      onData: () => ({ dispose() {} }),
      onExit: () => ({ dispose() {} }),
      resize: () => {},
      write: () => {},
      kill: () => {},
      pause: () => {},
      resume: () => {},
      clear: () => {},
      getProcessDynamically: async () => launchConfig.executable || '',
      getCwd: async () => launchConfig.cwd,
    } as any;
    FakePtyService.instances.push(this);
  }

  get pty() {
    return this.fakePty;
  }

  async start(): Promise<any> {
    this.started = true;
    return undefined;
  }
}

class MockTerminalClient implements ITerminalServiceClient {
  clientMessages: string[] = [];
  reconnectedIds: string[] = [];
  disconnectedIds: string[] = [];
  setConnectionClientId(): void {}
  input(): void {}
  onMessage(): void {}
  resize(): void {}
  disposeById(): void {}
  getProcessId(): number {
    return 0;
  }
  clientMessage(id: string, data: string): void {
    this.clientMessages.push(`${id}:${data}`);
  }
  closeClient(): void {}
  processChange(): void {}
  reconnected(id: string): void {
    this.reconnectedIds.push(id);
  }
  disconnected(id: string): void {
    this.disconnectedIds.push(id);
  }
  create2(): any {}
  ensureTerminal(): Promise<boolean> {
    return Promise.resolve(true);
  }
  getShellName(): string {
    return '';
  }
  $resolveWindowsShellPath(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }
  $resolveUnixShellPath(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }
  $resolveShellPath(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }
  detectAvailableProfiles(): Promise<any[]> {
    return Promise.resolve([]);
  }
  getDefaultSystemShell(): Promise<string> {
    return Promise.resolve('');
  }
  getOS(): any {
    return os.platform() === 'win32' ? 1 : 3;
  }
  getCodePlatformKey(): Promise<'osx' | 'windows' | 'linux'> {
    return Promise.resolve('osx');
  }
  getCwd(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }
  dispose(): void {}
}

describe('TerminalServiceImpl reconnect flow', () => {
  let injector: Injector;
  let manager: MockPtyServiceManager;
  let service: ITerminalNodeService;
  const clientId = 'client-1';
  const sessionId = `${clientId}|s1`;
  const launchConfig: IShellLaunchConfig = { executable: os.platform() === 'win32' ? 'powershell' : 'sh' };

  beforeEach(() => {
    injector = createNodeInjector([TerminalNodePtyModule]);
    manager = new MockPtyServiceManager();
    injector.overrideProviders(
      {
        token: PtyServiceManagerToken,
        useValue: manager,
      },
      {
        token: PtyService,
        useClass: FakePtyService,
      },
      {
        token: AppConfig,
        useValue: {
          terminalPtyCloseThreshold: 0,
        },
      },
    );
    service = injector.get(ITerminalNodeService);
    FakePtyService.instances = [];
  });

  it('recreates session and notifies client on reconnect', async () => {
    const client = new MockTerminalClient();
    (service as any).setClient(clientId, client);

    await service.create2(sessionId, 80, 24, launchConfig);
    expect(FakePtyService.instances.length).toBe(1);

    manager.fireReconnect();
    await new Promise((resolve) => setImmediate(resolve));

    expect(FakePtyService.instances.length).toBe(2);
    expect(client.reconnectedIds).toContain(sessionId);
    expect(client.clientMessages.some((msg) => msg.startsWith(`${sessionId}:\u001bc`))).toBe(true);
  });

  it('notifies client on disconnect', async () => {
    const client = new MockTerminalClient();
    (service as any).setClient(clientId, client);
    await service.create2(sessionId, 80, 24, launchConfig);

    manager.fireDisconnect();
    expect(client.disconnectedIds).toContain(sessionId);
  });
});
