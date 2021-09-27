import { Injector } from '@ali/common-di';
import { Emitter, CommandRegistry, CommandRegistryImpl, ILoggerManagerClient } from '@ali/ide-core-common';
import { RPCProtocol } from '@ali/ide-connection/lib/common/rpcProtocol';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { ExtHostAPIIdentifier, MainThreadAPIIdentifier } from '@ali/ide-kaitian-extension/lib/common/vscode';
import { ExtHostStatusBar } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.statusbar';
import { MainThreadStatusBar } from '@ali/ide-kaitian-extension/lib/browser/vscode/api/main.thread.statusbar';
import { StatusBarAlignment } from '@ali/ide-kaitian-extension/lib/common/vscode/ext-types';
import { IStatusBarService } from '@ali/ide-status-bar';
import { StatusBarService } from '@ali/ide-status-bar/lib/browser/status-bar.service';
import { MockLoggerManagerClient } from '../../__mocks__/loggermanager';
import { mockExtension } from '../../__mocks__/extensions';
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

  injector.addProviders(...[{
    token: IStatusBarService,
    useClass: StatusBarService,
  },  {
    token: ILoggerManagerClient,
    useClass: MockLoggerManagerClient,
  }, {
    token: CommandRegistry,
    useClass: CommandRegistryImpl,
  }]);
  beforeAll((done) => {
    mainthreadStatusbar = injector.get(MainThreadStatusBar, [rpcProtocolMain]);
    rpcProtocolMain.set<MainThreadStatusBar>(MainThreadAPIIdentifier.MainThreadStatusBar, mainthreadStatusbar);
    extHostStatusBar = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostStatusBar, new ExtHostStatusBar(rpcProtocolExt));
    statusbarService = injector.get(IStatusBarService);
    done();
  });

  it('should can create statusbar item', async (done) => {
    const statusbar = extHostStatusBar.createStatusBarItem(mockExtension, 'test', StatusBarAlignment.Left, 1);
    statusbar.show();
    statusbar.text = 'test';
    expect(statusbar).toBeDefined();
    statusbar.dispose();
    done();
  });

  it('should update statusbar', async (done) => {
    const statusbar = extHostStatusBar.createStatusBarItem(mockExtension, 'test', StatusBarAlignment.Right, 1);
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
    commandRegistry.registerCommand({ id: 'test:statusbar' }, {
      execute: () => {
        done();
      },
    });
    const statusbar = extHostStatusBar.createStatusBarItem(mockExtension, 'test', StatusBarAlignment.Left, 1);
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
