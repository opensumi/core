import { RPCProtocol } from '@opensumi/ide-connection';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Emitter, Disposable, ILogger } from '@opensumi/ide-core-common';
import { OperatingSystem } from '@opensumi/ide-core-common/lib/platform';
import { IExtension } from '@opensumi/ide-extension';
import {
  ITerminalApiService,
  ITerminalController,
  ITerminalProfileInternalService,
  ITerminalProfileService,
  ITerminalService,
  ITerminalServicePath,
} from '@opensumi/ide-terminal-next';
import { TerminalProfileService } from '@opensumi/ide-terminal-next/lib/browser/terminal.profile';
import { TerminalProfileInternalService } from '@opensumi/ide-terminal-next/lib/browser/terminal.profile.internal';
import { NodePtyTerminalService } from '@opensumi/ide-terminal-next/lib/browser/terminal.service';
import { EnvironmentVariableServiceToken } from '@opensumi/ide-terminal-next/lib/common/environmentVariable';

import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';
import { mockService } from '../../../../../../tools/dev-tool/src/mock-injector';
import {
  MockProfileService,
  MockTerminalProfileInternalService,
} from '../../../../../terminal-next/__tests__/browser/mock.service';
import { MainThreadTerminal } from '../../../../src/browser/vscode/api/main.thread.terminal';
import { MainThreadAPIIdentifier, ExtHostAPIIdentifier } from '../../../../src/common/vscode';
import {
  EnvironmentVariableCollection,
  ExtHostTerminal,
  Terminal,
} from '../../../../src/hosted/api/vscode/ext.host.terminal';


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
  injector.mockService(PreferenceService, {});
  injector.mockService(ILogger, {});
  injector.addProviders(
    {
      token: ITerminalApiService,
      useValue: mockService({
        terminals: [],
        onDidChangeActiveTerminal: () => Disposable.NULL,
        onDidCloseTerminal: () => Disposable.NULL,
        onDidOpenTerminal: () => Disposable.NULL,
        createTerminal: (options) => ({
          id: options.name,
        }),
      }),
    },
    {
      token: ITerminalProfileService,
      useValue: new MockProfileService(),
    },
    {
      token: ITerminalProfileInternalService,
      useValue: new MockTerminalProfileInternalService(),
    },
    {
      token: ITerminalService,
      useClass: NodePtyTerminalService,
    },
    {
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
      },
    },
    {
      token: ITerminalController,
      useValue: mockService({
        onInstanceRequestStartExtensionTerminal: () => Disposable.NULL,
        ready: {
          promise: Promise.resolve(),
        },
      }),
    },
    {
      token: EnvironmentVariableServiceToken,
      useValue: {
        set: () => {},
        delete: () => {},
      },
    },
  );

  extHost = rpcProtocolMain.set(ExtHostAPIIdentifier.ExtHostTerminal, injector.get(ExtHostTerminal, [rpcProtocolMain]));
  mainThread = rpcProtocolExt.set(
    MainThreadAPIIdentifier.MainThreadTerminal,
    injector.get(MainThreadTerminal, [rpcProtocolExt]),
  );

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
    mainThread['$createTerminal'] = () => Promise.resolve('fake-id-1');

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
    mainThread['_terminalProcessProxies'].set('fake-id-1', {} as any);

    expect(terminal4).toBeInstanceOf(Terminal);
    expect(terminal4.name).toBe('terminal-4');

    mainThread['$sendProcessReady'] = jest.fn(() => {});

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

  it('should change terminal name', async (done) => {
    const terminalName = 'terminal-should-change-name';
    const changedName = 'changed-name';
    const changeNameEmitter = new Emitter<string>();
    const closeEmitter = new Emitter<number | undefined>();
    const pty = {
      onDidWrite: new Emitter<string>().event,
      onDidChangeName: changeNameEmitter.event,
      onDidClose: closeEmitter.event,
      open: () => {},
      close: () => {},
    };

    const terminal = extHost.createExtensionTerminal({
      name: terminalName,
      pty,
    });

    setTimeout(async () => {
      extHost.onDidOpenTerminal((term) => {
        expect(terminal.name).toBe(terminalName);
      });

      await mainThread['proxy'].$onDidOpenTerminal({ id: terminal['id'], name: terminalName, isActive: true });
      await mainThread['proxy'].$acceptTerminalTitleChange(terminal['id'], changedName);

      expect(terminal.name).toBe(changedName);
      done();
    }, 0);
  });

  // #region ExthostTerminal#EnvironmentVariableCollection
  const mockExtension = {
    id: 'test-terminal-env',
  };
  const collection = extHost.getEnviromentVariableCollection(mockExtension as unknown as IExtension);
  // @ts-ignore
  const mocksyncEnvironmentVariableCollection = jest.spyOn(extHost, 'syncEnvironmentVariableCollection');

  it('ExthostTerminal#getEvniromentVariableCollection', () => {
    expect(collection instanceof EnvironmentVariableCollection).toBeTruthy();
    expect(collection.map.size).toBe(0);
    expect(collection.persistent).toBeTruthy();
  });

  it('EnvironmentVariableCollection#append', () => {
    collection.append('FOO', 'BAR');
    const serialized = [['FOO', { value: 'BAR', type: 2 /** EnvironmentVariableMutatorType.Append */ }]];

    expect(mocksyncEnvironmentVariableCollection).toBeCalled();
    expect(mocksyncEnvironmentVariableCollection).toBeCalledWith(mockExtension.id, collection);
    expect([...collection.map.entries()]).toEqual(serialized);
  });

  it('EnvironmentVariableCollection#replace', () => {
    collection.replace('FOO', 'BAR2');
    const serialized = [['FOO', { value: 'BAR2', type: 1 /** EnvironmentVariableMutatorType.Replace */ }]];

    expect(mocksyncEnvironmentVariableCollection).toBeCalled();
    expect(mocksyncEnvironmentVariableCollection).toBeCalledWith(mockExtension.id, collection);
    expect([...collection.map.entries()]).toEqual(serialized);
  });

  it('EnvironmentVariableCollection#prepend', () => {
    collection.prepend('FOO', 'BAR3');
    const serialized = [['FOO', { value: 'BAR3', type: 3 /** EnvironmentVariableMutatorType.Prepend */ }]];

    expect(mocksyncEnvironmentVariableCollection).toBeCalled();
    expect(mocksyncEnvironmentVariableCollection).toBeCalledWith(mockExtension.id, collection);
    expect([...collection.map.entries()]).toEqual(serialized);
  });

  it('EnvironmentVariableCollection#get', () => {
    const value = collection.get('FOO');
    expect(value).toEqual({ value: 'BAR3', type: 3 });
  });

  it('EnvironmentVariableCollection#forEach', async (done) => {
    collection.append('ENV1', 'VALUE1');
    collection.append('ENV2', 'VALUE2');
    collection.append('ENV3', 'VALUE3');

    const variableSet: string[] = [];
    const valueSet: string[] = [];

    collection.forEach((variable) => {
      variableSet.push(variable);
      valueSet.push(collection.get(variable)?.value!);
    });

    expect(variableSet).toEqual(['FOO', 'ENV1', 'ENV2', 'ENV3']);
    expect(valueSet).toEqual(['BAR3', 'VALUE1', 'VALUE2', 'VALUE3']);
    done();
  });

  it('EnvironmentVariableCollection#delete', () => {
    collection.delete('FOO');
    expect(collection.get('FOO')).toBeUndefined();
  });

  it('EnvironmentVariableCollection#clear', () => {
    collection.clear();
    expect(collection.map.size).toBe(0);
    expect(collection.get('ENV1')).toBeUndefined();
    expect(collection.get('ENV2')).toBeUndefined();
    expect(collection.get('ENV3')).toBeUndefined();
  });

  // #endregion
});
