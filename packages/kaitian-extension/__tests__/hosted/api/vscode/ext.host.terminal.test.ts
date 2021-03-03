import { Emitter, Disposable } from '@ali/ide-core-common';
import { RPCProtocol } from '@ali/ide-connection';
import { ITerminalApiService, ITerminalController } from '@ali/ide-terminal-next';
import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';
import { MainThreadAPIIdentifier, ExtHostAPIIdentifier } from '../../../../src/common/vscode';
import { ExtHostTerminal, Terminal } from '../../../../src/hosted/api/vscode/ext.host.terminal';
import { MainThreadTerminal } from '../../../../src/browser/vscode/api/main.thread.terminal';
import { mockService } from '../../../../../../tools/dev-tool/src/mock-injector';

const emitterA = new Emitter<any>();
const emitterB = new Emitter<any>();

const mockClientA = {
  send: (msg) => emitterB.fire(msg),
  onMessage: emitterA.event,
};
const mockClientB = {
  send: (msg) => emitterA.fire(msg),
  onMessage: emitterB.event,
};

const rpcProtocolExt = new RPCProtocol(mockClientA);
const rpcProtocolMain = new RPCProtocol(mockClientB);

let extHost: ExtHostTerminal;
let mainThread: MainThreadTerminal;

describe(__filename, () => {
  const injector = createBrowserInjector([]);

  injector.addProviders({
    token: ITerminalApiService,
    useValue: mockService({
      terminals: [],
      onDidChangeActiveTerminal: () => Disposable.NULL,
      onDidCloseTerminal: () => Disposable.NULL,
      onDidOpenTerminal: () => Disposable.NULL,
      createTerminal: (options) => {
        return {
          id: options.name,
        };
      },
    }),
  }, {
    token: ITerminalController,
    useValue: mockService({
      onInstanceRequestStartExtensionTerminal: () => Disposable.NULL,
      ready: {
        promise: Promise.resolve(),
      },
    }),
  });

  extHost = rpcProtocolMain.set(ExtHostAPIIdentifier.ExtHostTerminal, injector.get(ExtHostTerminal, [rpcProtocolMain]));
  mainThread = rpcProtocolExt.set(MainThreadAPIIdentifier.MainThreadTerminal, injector.get(MainThreadTerminal, [rpcProtocolExt]));

  afterAll(() => {
    mainThread.dispose();
  });

  it('should create terminal with parameters', async () => {
    const terminal1 = extHost.createTerminal('terminal-1');
    expect(terminal1.name).toBe('terminal-1');
  });

  it('didCloseTerminal should be work', async (done) => {
    const terminal1 = extHost.createTerminal('terminal-1.1');
    await mainThread['proxy'].$onDidOpenTerminal({ id: 'test-id', name: 'terminal-1.1', isActive: true });
    expect(terminal1.name).toBe('terminal-1.1');
    const proxyFn = jest.spyOn(extHost, '$onDidCloseTerminal');

    extHost.onDidCloseTerminal((e) => {
      expect(e['id']).toBe('test-id');
      expect(e['exitStatus']).toBeDefined();
      expect(e['exitStatus']?.code).toBe(-1);
      done();
    });

    await mainThread['proxy'].$onDidCloseTerminal({ id: 'test-id', code: -1 });
    expect(proxyFn).toBeCalled();
  });

  it('should create terminal with options', async () => {
    const terminal2 = extHost.createTerminalFromOptions({
      name: 'terminal-2',
    });
    expect(terminal2.name).toBe('terminal-2');
  });

  it('should create extension terminal', async () => {
    const emitter3 = new Emitter<string>();
    const terminal3 = extHost.createExtensionTerminal({
      name: 'terminal-3',
      pty: {
        onDidWrite: emitter3.event,
        open: () => {},
        close: () => {},
      },
    });
    expect(terminal3).toBeInstanceOf(Terminal);
    expect(terminal3.name).toBe('terminal-3');
  });

  it('extension terminal exit status should defined', async (done) => {

    mainThread['$createTerminal'] = () => {
      return Promise.resolve('fake-id-1');
    };

    mainThread['$sendProcessExit'] = () => {
      //
    };

    const mockCreateTerminal = jest.spyOn(mainThread, '$createTerminal');

    const mockTerminalExit = jest.spyOn(mainThread, '$sendProcessExit');

    const emitter4 = new Emitter<string>();
    const closeEmitter = new Emitter<void | number>();

    const terminal4 = extHost.createExtensionTerminal({
      name: 'terminal-4',
      pty: {
        onDidWrite: emitter4.event,
        onDidClose: closeEmitter.event,
        open: () => {},
        close: () => {},
      },
    });

    extHost['terminalsMap'].set('fake-id-1', terminal4);
    mainThread['_terminalProcessProxies'].set('fake-id-1', {

    } as any);

    expect(terminal4).toBeInstanceOf(Terminal);
    expect(terminal4.name).toBe('terminal-4');

    mainThread['$sendProcessReady'] = jest.fn(() => {
      return;
    });

    await mainThread['proxy'].$startExtensionTerminal('fake-id-1', {
      columns: 80,
      rows: 30,
    });

    expect(mockCreateTerminal).toBeCalled();

    const mockSetStatus = jest.spyOn(terminal4, 'setExitCode');

    // 要等待前台创建完 terminal 示例后，pty 事件绑定完再 fire
    setTimeout(() => {
      closeEmitter.fire(2);

      // 要等待事件 fire 后能监听到
      setTimeout(() => {
        expect(mockTerminalExit).toBeCalledWith('fake-id-1', 2);
        expect(mockSetStatus).toBeCalled();
        expect(terminal4.exitStatus).toBeDefined();
        expect(terminal4.exitStatus?.code).toBe(2);
        done();
      }, 0);
    }, 0);
  });
});
