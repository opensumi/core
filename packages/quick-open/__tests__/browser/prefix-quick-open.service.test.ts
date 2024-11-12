import { EDITOR_COMMANDS, QUICK_OPEN_COMMANDS } from '@opensumi/ide-core-browser';
import { CorePreferences } from '@opensumi/ide-core-browser/lib/core-preferences';
import {
  QuickOpenItem,
  QuickOpenModel,
  QuickOpenOptions,
  QuickOpenService,
} from '@opensumi/ide-core-browser/lib/quick-open';
import { Deferred, ILogger, localize } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector, mockService } from '@opensumi/ide-dev-tool/src/mock-injector';
import { IIconService, IThemeService } from '@opensumi/ide-theme';

import { PrefixQuickOpenServiceImpl, QuickOpenHandlerRegistry } from '../../src/browser/prefix-quick-open.service';
import { QuickTitleBar } from '../../src/browser/quick-title-bar';

describe('prefix quick open service test', () => {
  let injector: MockInjector;
  let handler: QuickOpenHandlerRegistry;

  const createHandler = (prefix: string, isDefault = false) =>
    mockService({
      default: !!isDefault,
      prefix,
      getModel() {
        return {
          onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void) {
            acceptor([]);
          },
        };
      },
      getOptions() {
        return {
          onClose: jest.fn(),
        };
      },
    });

  const fileSearchQuickCommandHandler = createHandler('...', true);
  const workspaceSymbolQuickOpenHandler = createHandler('#');
  const quickCommandHandler = createHandler('>');
  const helpQuickOpenHandler = createHandler('?');

  beforeEach(() => {
    injector = createBrowserInjector([]);
    injector.mockService(ILogger);
    handler = injector.get(QuickOpenHandlerRegistry);
    handler.registerHandler(fileSearchQuickCommandHandler, {
      title: localize('quickopen.tab.file'),
      commandId: 'workbench.action.quickOpen',
      order: 1,
    });
    handler.registerHandler(workspaceSymbolQuickOpenHandler, {
      title: localize('quickopen.tab.symbol'),
      order: 3,
      commandId: EDITOR_COMMANDS.SEARCH_WORKSPACE_SYMBOL.id,
      sub: {
        '#': {
          title: localize('quickopen.tab.class'),
          order: 2,
          commandId: EDITOR_COMMANDS.SEARCH_WORKSPACE_SYMBOL_CLASS.id,
        },
      },
    });
    handler.registerHandler(quickCommandHandler, {
      title: localize('quickopen.tab.command'),
      commandId: QUICK_OPEN_COMMANDS.OPEN.id,
      order: 4,
    });
    handler.registerHandler(helpQuickOpenHandler);
  });

  afterEach(async () => {
    await injector.disposeAll();
  });

  it('QuickOpenHandlerRegistry', () => {
    expect(handler.getSortedTabs().length).toBe(4);
    expect(handler.getSortedTabs()[1]).toMatchObject({ commandId: EDITOR_COMMANDS.SEARCH_WORKSPACE_SYMBOL_CLASS.id });
    expect(handler.getTabByHandler(workspaceSymbolQuickOpenHandler, '#1')).toMatchObject({
      commandId: EDITOR_COMMANDS.SEARCH_WORKSPACE_SYMBOL.id,
    });
    expect(handler.getTabByHandler(workspaceSymbolQuickOpenHandler, '##1')).toMatchObject({
      commandId: EDITOR_COMMANDS.SEARCH_WORKSPACE_SYMBOL_CLASS.id,
    });
  });

  it('PrefixQuickOpenServiceImpl restore last prefix', async () => {
    let quickOpenModel: QuickOpenModel;
    let quickOpenOptions: QuickOpenOptions;
    let d: Deferred<void>;
    injector.addProviders(
      {
        token: IThemeService,
        useValue: mockService({}),
      },
      {
        token: IIconService,
        useValue: mockService({}),
      },
      {
        token: CorePreferences,
        useValue: {
          'workbench.quickOpen.preserveInput': true,
        },
        override: true,
      },
      {
        token: QuickOpenService,
        useValue: mockService({
          open(model, options) {
            quickOpenModel = model;
            quickOpenOptions = options;
            d.resolve();
          },
        }),
      },
    );
    const prefixQuickOpenService = injector.get(PrefixQuickOpenServiceImpl);

    d = new Deferred();
    prefixQuickOpenService.open('#');
    await d.promise;
    await new Promise<void>((resolve) => {
      quickOpenModel.onType('#aa', () => {
        resolve();
      });
    });

    d = new Deferred();
    prefixQuickOpenService.open('#');
    await d.promise;
    expect(quickOpenOptions!.prefix).toBe('#aa');
  });
});
