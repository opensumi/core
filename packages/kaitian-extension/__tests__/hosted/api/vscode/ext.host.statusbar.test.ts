import { ExtHostStatusBar } from '../../../../src/hosted/api/vscode/ext.host.statusbar';
import { Emitter, ILoggerManagerClient, uuid } from '@ali/ide-core-common';
import { MainThreadAPIIdentifier, ExtHostAPIIdentifier } from '../../../../src/common/vscode';
import { RPCProtocol, WSChannelHandler } from '@ali/ide-connection';
import { MainThreadStatusBar } from '../../../../src/browser/vscode/api/main.thread.statusbar';
import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';
import { mockService } from '../../../../../../tools/dev-tool/src/mock-injector';
import { MockLoggerManagerClient } from '../../../__mock__/loggermanager';
import { IStatusBarService } from '@ali/ide-core-browser';
import { StatusBarService } from '@ali/ide-status-bar/lib/browser/status-bar.service';

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

let extHost: ExtHostStatusBar;
let mainThread: MainThreadStatusBar;

describe('vscode MainThreadStatusBar Test', () => {
  let injector;

  beforeEach(() => {
    injector = createBrowserInjector([]);
    injector.addProviders({
      token: ILoggerManagerClient,
      useClass: MockLoggerManagerClient,
    }, {
      token: WSChannelHandler,
      useValue: mockService({
        clientId: uuid(),
      }),
    }, {
      token: IStatusBarService,
      useClass: StatusBarService,
    });
    extHost = new ExtHostStatusBar(rpcProtocolExt);
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostStatusBar, extHost);

    mainThread = rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadStatusBar, injector.get(MainThreadStatusBar, [rpcProtocolMain]));
  });

  afterEach(() => {
    injector.disposeAll();
    jest.resetAllMocks();
  });

  it('support command', (done) => {
    // mock mainThread.$setMessage
    const $setMessage = jest.spyOn(mainThread, '$setMessage');

    const statusbar = extHost.createStatusBarItem();
    statusbar.command = 'test';
    statusbar.show();
    // statusbar host 调用 main 有一个 定时器
    setTimeout(() => {
      expect($setMessage.mock.calls[0][7]).toBe('test');
      expect($setMessage.mock.calls[0][8]).toBe(undefined);
      done();
    }, 100);
  });

  it('support command arguments', (done) => {
    // mock mainThread.$setMessage
    const $setMessage = jest.spyOn(mainThread, '$setMessage');

    const statusbar = extHost.createStatusBarItem();
    statusbar.command = {
      title: 'test',
      command: 'test',
      arguments: ['test2'],
    };
    statusbar.show();
    // statusbar host 调用 main 有一个 定时器
    setTimeout(() => {
      expect($setMessage.mock.calls[0][7]).toBe('test');
      expect($setMessage.mock.calls[0][8]).toStrictEqual(['test2']);
      done();
    }, 100);
  });

  it('support accessibilityInformation', (done) => {
    // mock mainThread.$setMessage
    const $setMessage = jest.spyOn(mainThread, '$setMessage');

    const statusbar = extHost.createStatusBarItem();
    statusbar.accessibilityInformation = {
      label: '蛋总',
      role: 'danzong',
    };
    statusbar.show();
    // statusbar host 调用 main 有一个 定时器
    setTimeout(() => {
      expect($setMessage.mock.calls[0][6]).toStrictEqual({'label': '蛋总', 'role': 'danzong'});
      done();
    }, 100);
  });

});
