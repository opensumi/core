import { RPCProtocol } from '@opensumi/ide-connection';
import { Emitter, Disposable } from '@opensumi/ide-core-common';
import { QuickPickService } from '@opensumi/ide-quick-open';
import { QuickTitleBar } from '@opensumi/ide-quick-open/lib/browser/quick-title-bar';

import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';
import { mockService } from '../../../../../../tools/dev-tool/src/mock-injector';
import { MainThreadQuickOpen } from '../../../../src/browser/vscode/api/main.thread.quickopen';
import { MainThreadAPIIdentifier, ExtHostAPIIdentifier } from '../../../../src/common/vscode';
import { ExtHostQuickOpen } from '../../../../src/hosted/api/vscode/ext.host.quickopen';


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

let extHost: ExtHostQuickOpen;
let mainThread: MainThreadQuickOpen;

describe(__filename, () => {
  const injector = createBrowserInjector([]);

  injector.addProviders(
    {
      token: QuickPickService,
      useValue: mockService({
        // 默认返回第一个
        show: (_, options) => (options.canPickMany ? [0] : 0),
      }),
    },
    {
      token: QuickTitleBar,
      useValue: mockService({
        onDidTriggerButton: () => Disposable.NULL,
      }),
    },
  );
  const extHostWorkspace = mockService({});
  extHost = new ExtHostQuickOpen(rpcProtocolExt, extHostWorkspace);
  rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostQuickOpen, extHost);

  mainThread = rpcProtocolMain.set(
    MainThreadAPIIdentifier.MainThreadQuickOpen,
    injector.get(MainThreadQuickOpen, [rpcProtocolMain]),
  );

  afterAll(() => {
    mainThread.dispose();
  });

  it('get quickpick item', async () => {
    const item = await extHost.showQuickPick(['a', 'b']);
    expect(item).toBe('a');
  });

  it('get quickpick item with canPickMany', async () => {
    const item = await extHost.showQuickPick(['a', 'b'], {
      canPickMany: true,
    });
    expect(item).toStrictEqual(['a']);
  });
});
