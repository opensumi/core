import {
  KeybindingRegistry,
  KeybindingRegistryImpl,
  RecentFilesManager,
  ILogger,
  PreferenceService,
} from '@opensumi/ide-core-browser';
import {
  CommandService,
  CommandServiceImpl,
  CommandRegistryImpl,
  CommandRegistry,
  DisposableCollection,
} from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { DocumentSymbol } from '@opensumi/ide-editor/lib/browser/breadcrumb/document-symbol';
import { FileSearchServicePath } from '@opensumi/ide-file-search/lib/common';
import { PrefixQuickOpenService } from '@opensumi/ide-quick-open';
import { QuickOpenHandlerRegistry } from '@opensumi/ide-quick-open/lib/browser/prefix-quick-open.service';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import * as modes from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { ClientAddonModule } from '../../src/browser';
import {
  FileSearchContribution,
  quickFileOpen,
  FileSearchQuickCommandHandler,
  matchLineReg,
  getValidateInput,
} from '../../src/browser/file-search.contribution';

describe('test for browser/file-search.contribution.ts', () => {
  let injector: MockInjector;
  let contribution: FileSearchContribution;
  const fakeOpenFn = jest.fn();
  const disposables = new DisposableCollection();

  beforeEach(() => {
    injector = createBrowserInjector(
      [ClientAddonModule],
      new MockInjector([
        {
          token: CommandRegistry,
          useClass: CommandRegistryImpl,
        },
        {
          token: CommandService,
          useClass: CommandServiceImpl,
        },
        {
          token: KeybindingRegistry,
          useClass: KeybindingRegistryImpl,
        },
        {
          token: FileSearchQuickCommandHandler,
          useValue: {},
        },
        {
          token: PrefixQuickOpenService,
          useValue: {
            open: fakeOpenFn,
          },
        },
        QuickOpenHandlerRegistry,
      ]),
    );

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

describe('file-search-quickopen', () => {
  let injector: MockInjector;
  let fileSearchQuickOpenHandler: FileSearchQuickCommandHandler;

  const testDS: DocumentSymbol[] = [
    {
      name: 'test1',
      detail: 'test1Detail',
      tags: [],
      kind: modes.SymbolKind.Class,
      containerName: 'test Class',
      range: {
        startColumn: 1,
        endColumn: 10,
        startLineNumber: 1,
        endLineNumber: 10,
      },
      selectionRange: {
        startColumn: 1,
        endColumn: 10,
        startLineNumber: 1,
        endLineNumber: 10,
      },
      children: [
        {
          name: 'test1Method',
          detail: 'test1MethodDetail',
          kind: modes.SymbolKind.Method,
          containerName: 'test1Method',
          tags: [],
          range: {
            startColumn: 4,
            endColumn: 5,
            startLineNumber: 2,
            endLineNumber: 4,
          },
          selectionRange: {
            startColumn: 4,
            endColumn: 5,
            startLineNumber: 2,
            endLineNumber: 4,
          },
        },
      ],
    },
  ];

  modes.DocumentSymbolProviderRegistry['all'] = () => [
    {
      provideDocumentSymbols: () => testDS,
    },
  ];

  beforeEach(() => {
    injector = createBrowserInjector([]);
    injector.addProviders(
      FileSearchQuickCommandHandler,
      {
        token: CommandService,
        useValue: {},
      },
      {
        token: FileSearchServicePath,
        useValue: {
          find: () => ['/file/a', '/file/b'],
        },
      },
      {
        token: WorkbenchEditorService,
        useValue: {},
      },
      {
        token: IWorkspaceService,
        useValue: {
          asRelativePath: () => '',
          roots: [],
        },
      },
      {
        token: RecentFilesManager,
        useValue: {
          getMostRecentlyOpenedFiles: () => [],
        },
      },
    );
    injector.mockService(PreferenceService, {});
    injector.mockService(ILogger, {});
    injector.mockService(IEditorDocumentModelService, {
      createModelReference: (uri) => ({
        instance: {
          uri,
          getMonacoModel: () => ({
            uri,
            getLanguageIdentifier: () => 'javascript',
          }),
        },
        dispose: jest.fn(),
      }),
    });
    fileSearchQuickOpenHandler = injector.get(FileSearchQuickCommandHandler);
  });

  afterEach(() => {
    injector.disposeAll();
  });

  it('onType', (done) => {
    const model = fileSearchQuickOpenHandler.getModel();
    model.onType('a', (item) => {
      expect(item.length).toBe(2);
      expect(item[0].getLabel()).toBe('a');
      done();
    });
  });

  it('onType for symbols', (done) => {
    const model = fileSearchQuickOpenHandler.getModel();
    model.onType('a@', (item) => {
      expect(item.length).toBe(2);
      expect(item[0].getLabel()).toBe('test1');
      expect(item[0].getIconClass()).toBe('codicon codicon-symbol-class');
      done();
    });
  });
});
