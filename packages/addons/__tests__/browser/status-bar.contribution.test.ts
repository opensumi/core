import {
  BrowserConnectionCloseEvent,
  BrowserConnectionOpenEvent,
  CommandService,
  EventBusImpl,
  IEventBus,
} from '@opensumi/ide-core-common';
import { createBrowserInjector, getBrowserMockInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';

import { ClientAddonModule } from '../../src/browser';
import { StatusBarContribution } from '../../src/browser/status-bar-contribution';

describe('test for browser/status-bar-contribution.ts', () => {
  let injector: MockInjector;
  let eventBus: IEventBus;
  const fakeExecCmd = jest.fn();

  beforeEach(() => {
    injector = createBrowserInjector(
      [ClientAddonModule],
      getBrowserMockInjector([
        {
          token: IEventBus,
          useClass: EventBusImpl,
        },
        {
          token: CommandService,
          useValue: {
            executeCommand: fakeExecCmd,
          },
        },
      ]),
    );

    eventBus = injector.get(IEventBus);
    // 获取对象实例的时候才开始注册事件
    injector.get(StatusBarContribution);
  });

  afterEach(() => {
    fakeExecCmd.mockReset();
  });

  it('handle BrowserConnectionOpenEvent event', () => {
    eventBus.fire(new BrowserConnectionOpenEvent());
    expect(fakeExecCmd).toHaveBeenCalledTimes(1);
    expect(fakeExecCmd).toHaveBeenCalledWith('statusbar.changeBackgroundColor', 'var(--statusBar-background)');
  });

  it('handle BrowserConnectionCloseEvent event', () => {
    eventBus.fire(new BrowserConnectionCloseEvent());
    expect(fakeExecCmd).toHaveBeenCalledTimes(1);
    expect(fakeExecCmd).toHaveBeenCalledWith(
      'statusbar.changeBackgroundColor',
      'var(--kt-statusbar-offline-background)',
    );
  });
});
