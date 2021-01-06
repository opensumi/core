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

  extHost = new ExtHostTerminal(rpcProtocolExt);
  rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostTerminal, extHost);
  mainThread = rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadTerminal, injector.get(MainThreadTerminal, [rpcProtocolMain]));

  afterAll(() => {
    mainThread.dispose();
  });

  it('should create terminal with parameters', async () => {
    const terminal1 = extHost.createTerminal('terminal-1');
    expect(terminal1.name).toBe('terminal-1');
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
});
