import { CommandService, CommandServiceImpl, CommandRegistryImpl, CommandRegistry, DisposableCollection } from '@ali/ide-core-common';
import { KeybindingRegistry, KeybindingRegistryImpl } from '@ali/ide-core-browser';
import { PrefixQuickOpenService } from '@ali/ide-quick-open';
import { QuickOpenHandlerRegistry } from '@ali/ide-quick-open/lib/browser/prefix-quick-open.service';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

import { ClientAddonModule } from '../../src/browser';
import { FileSearchContribution, quickFileOpen, FileSearchQuickCommandHandler, matchLineReg, getValidateInput } from '../../src/browser/file-search.contribution';

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
    expect(commands.length).toBe(2);
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

  it('get range by search quickopen', () => {
    const match1 = '/some/file.js(73,84)'.match(matchLineReg)!;
    expect(match1[1]).toBe('/some/file.js');
    expect(match1[2]).toBe('73');
    expect(match1[3]).toBe('84');

    const match2 = '/some/file.js#73,84'.match(matchLineReg)!;
    expect(match2[1]).toBe('/some/file.js');
    expect(match2[2]).toBe('73');
    expect(match2[3]).toBe('84');

    const match3 = '/some/file.js#L73'.match(matchLineReg)!;
    expect(match3[1]).toBe('/some/file.js');
    expect(match3[2]).toBe('73');

    const match4 = '/some/file.js:73:84'.match(matchLineReg)!;
    expect(match4[1]).toBe('/some/file.js');
    expect(match4[2]).toBe('73');
    expect(match4[3]).toBe('84');

    const match5 = '/some/file.js:73'.match(matchLineReg)!;
    expect(match5[1]).toBe('/some/file.js');
    expect(match5[2]).toBe('73');
  });

  it('get validate input', () => {
    const validate = getValidateInput('package.json(1,1)');
    expect(validate).toBe('package.json');
  });
});
