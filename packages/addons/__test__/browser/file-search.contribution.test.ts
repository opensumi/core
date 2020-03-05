import { CommandService, CommandServiceImpl, CommandRegistryImpl, CommandRegistry, DisposableCollection } from '@ali/ide-core-common';
import { KeybindingRegistry, KeybindingRegistryImpl } from '@ali/ide-core-browser';
import { PrefixQuickOpenService } from '@ali/ide-quick-open';
import { QuickOpenHandlerRegistry } from '@ali/ide-quick-open/lib/browser/prefix-quick-open.service';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

import { ClientAddonModule } from '../../src/browser';
import { FileSearchContribution, quickFileOpen, FileSearchQuickCommandHandler } from '../../src/browser/file-search.contribution';

describe('test for browser/file-search.contribution.ts', () => {
  let injector: MockInjector;
  let contribution: FileSearchContribution;
  const fakeOpenFn = jest.fn();
  const disposables = new DisposableCollection();

  beforeEach(() => {
    injector = createBrowserInjector([ ClientAddonModule ], new MockInjector([
      {
        token: CommandRegistry,
        useClass: CommandRegistryImpl,
      }, {
        token: CommandService,
        useClass: CommandServiceImpl,
      }, {
        token: KeybindingRegistry,
        useClass: KeybindingRegistryImpl,
      }, {
        token: FileSearchQuickCommandHandler,
        useValue: {},
      }, {
        token: PrefixQuickOpenService,
        useValue: {
          open: fakeOpenFn,
        },
      },
      QuickOpenHandlerRegistry,
    ]));

    // 获取对象实例的时候才开始注册事件
    contribution = injector.get(FileSearchContribution);
  });

  afterEach(() => {
    fakeOpenFn.mockReset();
    disposables.dispose();
  });

  it('registerCommands', async () => {
    const registry = injector.get<CommandRegistry>(CommandRegistry);
    const commandService = injector.get<CommandService>(CommandService);

    contribution.registerCommands(registry);

    const commands = registry.getCommands();
    expect(commands.length).toBe(1);
    expect(commands[0].id).toBe(quickFileOpen.id);

    await commandService.executeCommand(quickFileOpen.id);
    expect(fakeOpenFn).toBeCalledTimes(1);
    expect(fakeOpenFn).toBeCalledWith('...');
  });

  it('registerKeybindings', () => {
    const registry = injector.get<KeybindingRegistry>(KeybindingRegistry);

    disposables.push(
      registry.onKeybindingsChanged((e) => {
        expect(e.affectsCommands.length).toBe(1);
        expect(e.affectsCommands[0]).toBe(quickFileOpen.id);
      }),
    );

    contribution.registerKeybindings(registry);
  });

  it('registerQuickOpenHandlers', () => {
    const registry = injector.get<QuickOpenHandlerRegistry>(QuickOpenHandlerRegistry);
    expect(registry.getHandlers().length).toBe(0);

    contribution.registerQuickOpenHandlers(registry);
    expect(registry.getHandlers().length).toBe(1);
  });
});
