import { Injector } from '@opensumi/di';
import { RPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { Emitter, CommandRegistry, CommandRegistryImpl, ILoggerManagerClient } from '@opensumi/ide-core-common';
import { MainThreadStatusBar } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.statusbar';
import { ExtHostAPIIdentifier, MainThreadAPIIdentifier } from '@opensumi/ide-extension/lib/common/vscode';
import { StatusBarAlignment } from '@opensumi/ide-extension/lib/common/vscode/ext-types';
import { ExtHostStatusBar } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.statusbar';
import { IStatusBarService } from '@opensumi/ide-status-bar';
import { StatusBarService } from '@opensumi/ide-status-bar/lib/browser/status-bar.service';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { mockExtensionDescription } from '../../__mocks__/extensions';
import { MockLoggerManagerClient } from '../../__mocks__/loggermanager';
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

describe('MainThreadStatusBar API Test Suites', () => {
  const injector = createBrowserInjector([], new Injector([]));
  let extHostStatusBar: ExtHostStatusBar;
  let mainthreadStatusbar: MainThreadStatusBar;
  let statusbarService: IStatusBarService;

  injector.addProviders(
    ...[
      {
        token: IStatusBarService,
        useClass: StatusBarService,
      },
      {
        token: ILoggerManagerClient,
        useClass: MockLoggerManagerClient,
      },
      {
        token: CommandRegistry,
        useClass: CommandRegistryImpl,
      },
    ],
  );
  beforeAll((done) => {
    mainthreadStatusbar = injector.get(MainThreadStatusBar, [rpcProtocolMain]);
    rpcProtocolMain.set<MainThreadStatusBar>(MainThreadAPIIdentifier.MainThreadStatusBar, mainthreadStatusbar);
    extHostStatusBar = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostStatusBar, new ExtHostStatusBar(rpcProtocolExt));
    statusbarService = injector.get(IStatusBarService);
    done();
  });

  it('should can create statusbar item', async (done) => {
    const statusbar = extHostStatusBar.createStatusBarItem(
      mockExtensionDescription,
      'test',
      StatusBarAlignment.Left,
      1,
    );
    statusbar.show();
    statusbar.text = 'test';
    expect(statusbar).toBeDefined();
    statusbar.dispose();
    done();
  });

  it('should update statusbar', async (done) => {
    const statusbar = extHostStatusBar.createStatusBarItem(
      mockExtensionDescription,
      'test',
      StatusBarAlignment.Right,
      1,
    );
    statusbar.show();
    statusbar.text = 'test1';
    statusbar.color = '#ff004f';
    statusbar.command = 'test:command';
    statusbar.tooltip = 'testtooltip';

    setTimeout(() => {
      expect(statusbarService.rightEntries.length).toBe(1);
      const mainthreadStatusbarItem = statusbarService.rightEntries[0];
      expect(mainthreadStatusbarItem.text).toBe('test1');
      expect(mainthreadStatusbarItem.alignment).toBe(1);
      expect(mainthreadStatusbarItem.color).toBe('#ff004f');
      expect(mainthreadStatusbarItem.command).toBe('test:command');
      expect(mainthreadStatusbarItem.tooltip).toBe('testtooltip');
      statusbar.dispose();
      done();
    }, 50);
  });

  it('can execute command via statusbar', async (done) => {
    const commandRegistry = injector.get<CommandRegistry>(CommandRegistry);
    commandRegistry.registerCommand(
      { id: 'test:statusbar' },
      {
        execute: () => {
          done();
        },
      },
    );
    const statusbar = extHostStatusBar.createStatusBarItem(
      mockExtensionDescription,
      'test',
      StatusBarAlignment.Left,
      1,
    );
    statusbar.command = 'test:statusbar';
    statusbar.show();
    setTimeout(() => {
      const mainthreadStatusbarItem = statusbarService.leftEntries[0];
      if (mainthreadStatusbarItem.onClick) {
        mainthreadStatusbarItem.onClick({});
      }
    }, 40);
  });
});
