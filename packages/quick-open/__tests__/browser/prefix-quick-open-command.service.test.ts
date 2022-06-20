import { QuickOpenService, QuickOpenModel, QuickOpenOptions, IContextKeyService } from '@opensumi/ide-core-browser/src';
import { ILogger, localize, Deferred, CommandRegistry } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector, mockService } from '@opensumi/ide-dev-tool/src/mock-injector';
import { IIconService, IThemeService } from '@opensumi/ide-theme';
import { Event } from '@opensumi/ide-utils';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { QuickOpenHandlerRegistry, PrefixQuickOpenServiceImpl } from '../../src/browser/prefix-quick-open.service';
import { QuickCommandHandler } from '../../src/browser/quick-open.command.service';
import { QuickTitleBar } from '../../src/browser/quick-title-bar';
import { QUICK_OPEN_COMMANDS } from '../../src/common';

describe('prefix quick open command service test', () => {
  let injector: MockInjector;
  let handler: QuickOpenHandlerRegistry;
  let quickCommandHandler: QuickCommandHandler;

  beforeEach(async () => {
    injector = createBrowserInjector([]);
    injector.overrideProviders(
      {
        token: IWorkspaceService,
        useValue: {
          getMostRecentlyUsedCommands: () => [{ id: 'a', label: 'aaa' }],
        },
      },
      {
        token: QuickTitleBar,
        useValue: mockService({}),
      },
      {
        token: IThemeService,
        useValue: mockService({}),
      },
      {
        token: IIconService,
        useValue: mockService({}),
      },
      {
        token: IContextKeyService,
        useValue: {
          match: () => true,
          getKeysInWhen: () => [],
          get onDidChangeContext() {
            return Event.None;
          },
        },
      },
    );
    injector.mockService(ILogger);
    handler = injector.get(QuickOpenHandlerRegistry);
    quickCommandHandler = injector.get(QuickCommandHandler);
    handler.registerHandler(quickCommandHandler, {
      title: localize('quickopen.tab.command'),
      commandId: QUICK_OPEN_COMMANDS.OPEN.id,
      order: 1,
    });
    const commandRegistry = injector.get(CommandRegistry) as CommandRegistry;
    [
      { id: 'a', label: 'aaa' },
      { id: 'b', label: 'fff' },
      { id: 'c', label: 'zzz' },
    ].forEach((command) => {
      commandRegistry.registerCommand(command, {
        execute: jest.fn(),
      });
    });
    await quickCommandHandler.init();
  });

  afterEach(() => {
    injector.disposeAll();
  });

  it('should display all commands', async () => {
    let quickOpenModel: QuickOpenModel;
    let quickOpenOptions: QuickOpenOptions;
    let d: Deferred<void>;
    injector.overrideProviders({
      token: QuickOpenService,
      useValue: mockService({
        open(model, options) {
          quickOpenModel = model;
          quickOpenOptions = options;
          d.resolve();
        },
      }),
    });
    injector.overrideProviders({
      token: IWorkspaceService,
      useValue: {
        getMostRecentlyUsedCommands: () => [
          { id: 'a', label: 'aaa' },
          { id: 'not-exists-1', label: 'not-exists-1' },
          { id: 'not-exists-2', label: 'not-exists-2' },
          { id: 'not-exists-3', label: 'not-exists-3' },
          { id: 'not-exists-4', label: 'not-exists-4' },
        ],
      },
    });

    await quickCommandHandler.init();

    d = new Deferred();
    const prefixQuickOpenService = injector.get(PrefixQuickOpenServiceImpl);
    prefixQuickOpenService.open('>');
    await d.promise;
    await new Promise<void>((resolve) => {
      quickOpenModel.onType('>', (items) => {
        expect(items.length).toEqual(3);
        resolve();
      });
    });
  });
});
