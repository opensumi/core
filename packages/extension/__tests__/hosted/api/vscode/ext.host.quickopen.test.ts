import { RPCProtocol } from '@opensumi/ide-connection';
import { Emitter, Disposable } from '@opensumi/ide-core-common';
import { IQuickInputService, QuickOpenService, QuickPickService } from '@opensumi/ide-quick-open';
import { QuickInputService } from '@opensumi/ide-quick-open/lib/browser/quick-input-service';
import { QuickTitleBar } from '@opensumi/ide-quick-open/lib/browser/quick-title-bar';
import { MockQuickOpenService } from '@opensumi/ide-quick-open/lib/common/mocks/quick-open.service';
import { IconService } from '@opensumi/ide-theme/lib/browser/icon.service';
import { IIconService, IThemeService } from '@opensumi/ide-theme/lib/common/theme.service';

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

describe('ext host quickopen test', () => {
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
      token: IThemeService,
      useValue: {
        applyTheme: () => {},
      },
    },
    {
      token: IIconService,
      useClass: IconService,
    },
    {
      token: IQuickInputService,
      useClass: QuickInputService,
    },
    {
      token: QuickOpenService,
      useValue: {
        open: () => Promise.resolve(),
      },
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

  it('trigger quick open item button', async () => {
    extHost.$onDidTriggerItemButton(0, 0);
  });

  it('invoke show input box', async () => {
    extHost.showInputBox({
      title: 'test input box',
      value: '0',
    });
  });

  it('set input box items', async () => {
    const quickPick = extHost.createQuickPick();
    quickPick.items = [
      {
        label: 'test button',
      },
    ];
    expect(quickPick.items.length).toBe(1);
  });
});
