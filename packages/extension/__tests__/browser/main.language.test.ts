
import type vscode from 'vscode';


import { RPCProtocol } from '@opensumi/ide-connection';
import { Emitter, CancellationToken, MonacoService, DisposableCollection } from '@opensumi/ide-core-browser';
import { useMockStorage } from '@opensumi/ide-core-browser/__mocks__/storage';
import { URI, Uri, Position } from '@opensumi/ide-core-common';
import {
  EvaluatableExpressionServiceImpl,
  IEvaluatableExpressionService,
} from '@opensumi/ide-debug/lib/browser/editor/evaluatable-expression';
import { IDocPersistentCacheProvider } from '@opensumi/ide-editor';
import { TestEditorDocumentProvider } from '@opensumi/ide-editor/__tests__/browser/test-providers';
import {
  EditorDocumentModelServiceImpl,
  EditorDocumentModelContentRegistryImpl,
} from '@opensumi/ide-editor/lib/browser/doc-model/main';
import { CallHierarchyService } from '@opensumi/ide-editor/lib/browser/monaco-contrib';
import {
  IEditorDocumentModelService,
  IEditorDocumentModelContentRegistry,
  EmptyDocCacheImpl,
} from '@opensumi/ide-editor/src/browser';
import { ICallHierarchyService } from '@opensumi/ide-monaco/lib/browser/contrib';
import { ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import * as monacoModes from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import { createModel } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneEditor';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { mockService } from '../../../../tools/dev-tool/src/mock-injector';
import { MockedMonacoService } from '../../../monaco/__mocks__/monaco.service.mock';
import { MainThreadCommands } from '../../src/browser/vscode/api/main.thread.commands';
import { MainThreadLanguages } from '../../src/browser/vscode/api/main.thread.language';
import { ExtHostAPIIdentifier, IExtensionDescription, MainThreadAPIIdentifier } from '../../src/common/vscode';
import * as types from '../../src/common/vscode/ext-types';
import * as modes from '../../src/common/vscode/model.api';
import { ExtensionDocumentDataManagerImpl } from '../../src/hosted/api/vscode/doc';
import { ExtHostCommands } from '../../src/hosted/api/vscode/ext.host.command';
import { ExtHostLanguages } from '../../src/hosted/api/vscode/ext.host.language';

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

const defaultSelector = { scheme: 'far' };
const disposables: DisposableCollection = new DisposableCollection();

const extHostDocuments = new ExtensionDocumentDataManagerImpl(rpcProtocolExt);

let extHost: ExtHostLanguages;
let mainThread: MainThreadLanguages;
let model: ITextModel;

describe('ExtHostLanguageFeatures', () => {
  const injector = createBrowserInjector([]);
  let monacoService: MonacoService;

  injector.addProviders(
    {
      token: MonacoService,
      useClass: MockedMonacoService,
    },
    {
      token: ICallHierarchyService,
      useClass: CallHierarchyService,
    },
    {
      token: IEvaluatableExpressionService,
      useClass: EvaluatableExpressionServiceImpl,
    },
    {
      token: IEditorDocumentModelService,
      useClass: EditorDocumentModelServiceImpl,
    },
    {
      token: IEditorDocumentModelContentRegistry,
      useClass: EditorDocumentModelContentRegistryImpl,
    },
    {
      token: IDocPersistentCacheProvider,
      useClass: EmptyDocCacheImpl,
    },
    {
      token: IEditorDocumentModelService,
      useValue: {},
    },
  );

  useMockStorage(injector);

  const editorDocModelRegistry: IEditorDocumentModelContentRegistry = injector.get(IEditorDocumentModelContentRegistry);
  editorDocModelRegistry.registerEditorDocumentModelContentProvider(TestEditorDocumentProvider);

  beforeAll(async (done) => {
    monacoService = injector.get(MonacoService);
    await monacoService.loadMonaco();
    model = createModel(
      ['This is the first line', 'This is the second line', 'This is the third line'].join('\n'),
      undefined,
      monaco.Uri.parse('far://testing/file.a'),
    );
    extHostDocuments.$fireModelOpenedEvent({
      uri: model.uri.toString(),
      dirty: false,
      versionId: model.getVersionId(),
      languageId: 'a',
      lines: model.getValue().split(model.getEOL()),
      eol: model.getEOL(),
    });
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostDocuments, extHostDocuments);

    const commands = new ExtHostCommands(rpcProtocolExt);
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostCommands, commands);

    const mainCommands = injector.get(MainThreadCommands, [rpcProtocolMain]);
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadCommands, mainCommands);

    extHost = new ExtHostLanguages(rpcProtocolExt, extHostDocuments, commands, mockService({}));
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostLanguages, extHost);

    mainThread = rpcProtocolMain.set(
      MainThreadAPIIdentifier.MainThreadLanguages,
      injector.get(MainThreadLanguages, [rpcProtocolMain]),
    );

    monaco.languages.register({
      id: 'a',
      extensions: ['.a'],
    });
    done();
  });

  afterAll(() => {
    model.dispose();
    mainThread.dispose();
    disposables.dispose();
  });

  test('CodeLens, evil provider', async (done) => {
    disposables.push(
      extHost.registerCodeLensProvider(
        defaultSelector,
        new (class implements vscode.CodeLensProvider {
          provideCodeLenses(): any {
            throw new Error('evil');
          }
        })(),
      ),
    );
    disposables.push(
      extHost.registerCodeLensProvider(
        defaultSelector,
        new (class implements vscode.CodeLensProvider {
          provideCodeLenses() {
            return [new types.CodeLens(new types.Range(0, 0, 0, 0))];
          }
        })(),
      ),
    );
    setTimeout(async () => {
      const provider = monacoModes.CodeLensProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const value = (await provider.provideCodeLenses(model, CancellationToken.None))!;
      expect(value.lenses.length).toEqual(1);
      done();
    }, 0);
  });

  test('CodeLens, do not resolve a resolved lens', async (done) => {
    disposables.push(
      extHost.registerCodeLensProvider(
        defaultSelector,
        new (class implements vscode.CodeLensProvider {
          provideCodeLenses(): any {
            return [new types.CodeLens(new types.Range(0, 0, 0, 0), { command: 'id', title: 'Title' })];
          }
          resolveCodeLens(): any {
            // eslint-disable-next-line no-console
            console.warn('do not resolve');
          }
        })(),
      ),
    );
    setTimeout(async () => {
      const provider = monacoModes.CodeLensProviderRegistry.ordered(model)[0];
      const value = (await provider.provideCodeLenses(model, CancellationToken.None))!;
      expect(value.lenses.length).toEqual(1);
      const symbol = value.lenses[0];
      expect(symbol!.command!.id).toEqual('id');
      expect(symbol!.command!.title).toEqual('Title');
      done();
    }, 0);
  });
  test('CodeLens, missing command', async (done) => {
    disposables.push(
      extHost.registerCodeLensProvider(
        defaultSelector,
        new (class implements vscode.CodeLensProvider {
          provideCodeLenses() {
            return [new types.CodeLens(new types.Range(0, 0, 0, 0))];
          }
        })(),
      ),
    );
    setTimeout(async () => {
      const provider = monacoModes.CodeLensProviderRegistry.ordered(model)[0];
      const value = (await provider.provideCodeLenses(model, CancellationToken.None))!;
      expect(value.lenses.length).toEqual(1);
      const symbol = value.lenses[0];
      expect(symbol.command).toBeUndefined();
      done();
    }, 0);
  });
  test('Definition, data conversion', async (done) => {
    disposables.push(
      extHost.registerDefinitionProvider(
        defaultSelector,
        new (class implements vscode.DefinitionProvider {
          provideDefinition(): any {
            return [new types.Location(model.uri, new types.Range(1, 2, 3, 4))];
          }
        })(),
      ),
    );
    setTimeout(async () => {
      const provider = monacoModes.DefinitionProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const value = (await provider.provideDefinition(
        model,
        { lineNumber: 1, column: 1 } as any,
        CancellationToken.None,
      ))!;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(value.length).toEqual(1);
      expect(value[0].range).toStrictEqual({ startLineNumber: 2, startColumn: 3, endLineNumber: 4, endColumn: 5 });
      done();
    }, 0);
  });

  test('Implementation, data conversion', async (done) => {
    disposables.push(
      extHost.registerImplementationProvider(
        defaultSelector,
        new (class implements vscode.ImplementationProvider {
          provideImplementation(): any {
            return [new types.Location(model.uri, new types.Range(1, 2, 3, 4))];
          }
        })(),
      ),
    );
    setTimeout(async () => {
      const provider = monacoModes.ImplementationProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const value = await provider.provideImplementation(
        model,
        { lineNumber: 1, column: 1 } as any,
        CancellationToken.None,
      );
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(value!.length).toEqual(1);
      expect(value![0].range).toStrictEqual({ startLineNumber: 2, startColumn: 3, endLineNumber: 4, endColumn: 5 });
      done();
    }, 0);
  });
  test('Type Definition, data conversion', async (done) => {
    disposables.push(
      extHost.registerTypeDefinitionProvider(
        defaultSelector,
        new (class implements vscode.TypeDefinitionProvider {
          provideTypeDefinition(): any {
            return [new types.Location(model.uri, new types.Range(1, 2, 3, 4))];
          }
        })(),
      ),
    );
    setTimeout(async () => {
      const provider = monacoModes.TypeDefinitionProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const value = await provider.provideTypeDefinition(
        model,
        { lineNumber: 1, column: 1 } as any,
        CancellationToken.None,
      );
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(value!.length).toEqual(1);
      expect(value![0].range).toStrictEqual({ startLineNumber: 2, startColumn: 3, endLineNumber: 4, endColumn: 5 });
      done();
    }, 0);
  });
  test('HoverProvider, word range at pos', async (done) => {
    disposables.push(
      extHost.registerHoverProvider(
        defaultSelector,
        new (class implements vscode.HoverProvider {
          provideHover(): any {
            return new types.Hover('Hello');
          }
        })(),
      ),
    );
    setTimeout(async () => {
      const provider = monacoModes.HoverProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const value = (await provider.provideHover(model, { lineNumber: 1, column: 1 } as any, CancellationToken.None))!;
      expect(value.range).toStrictEqual({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 5 });
      done();
    }, 0);
  });
  test('HoverProvider, given range', async (done) => {
    disposables.push(
      extHost.registerHoverProvider(
        defaultSelector,
        new (class implements vscode.HoverProvider {
          provideHover(): any {
            return new types.Hover('Hello', new types.Range(3, 0, 8, 7));
          }
        })(),
      ),
    );
    setTimeout(async () => {
      const provider = monacoModes.HoverProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const value = (await provider.provideHover(model, { lineNumber: 1, column: 1 } as any, CancellationToken.None))!;
      expect(value.range).toStrictEqual({ startLineNumber: 4, startColumn: 1, endLineNumber: 9, endColumn: 8 });
      done();
    }, 0);
  });

  test('Occurrences, data conversion', async (done) => {
    disposables.push(
      extHost.registerDocumentHighlightProvider(
        defaultSelector,
        new (class implements vscode.DocumentHighlightProvider {
          provideDocumentHighlights(): any {
            return [new types.DocumentHighlight(new types.Range(0, 0, 0, 4))];
          }
        })(),
      ),
    );
    setTimeout(async () => {
      const provider = monacoModes.DocumentHighlightProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const value = await provider.provideDocumentHighlights(
        model,
        { lineNumber: 1, column: 2 } as any,
        CancellationToken.None,
      );
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(value!.length).toEqual(1);
      expect(value![0].range).toStrictEqual({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 5 });
      expect(value![0].kind).toEqual(modes.DocumentHighlightKind.Text);
      done();
    }, 0);
  });

  // --- references

  test('References, data conversion', async (done) => {
    disposables.push(
      extHost.registerReferenceProvider(
        defaultSelector,
        new (class implements vscode.ReferenceProvider {
          provideReferences(): any {
            return [new types.Location(model.uri, new types.Position(0, 0))];
          }
        })(),
      ),
    );
    setTimeout(async () => {
      const provider = monacoModes.ReferenceProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const value = await provider.provideReferences(
        model,
        { lineNumber: 1, column: 2 } as any,
        {} as any,
        CancellationToken.None,
      );
      expect(value!.length).toEqual(1);
      expect(value![0].range).toStrictEqual({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
      expect(value![0].uri.toString()).toEqual(model.uri.toString());
      done();
    }, 0);
  });

  // --- quick fix
  const extension = {
    name: 'codeactiontest',
    displayName: 'CodeAction Test',
    id: 'codeactiontest.test',
    activate: () => {},
    deactivate: () => {},
    toJSON: () => {},
  } as unknown as IExtensionDescription;
  test('Quick Fix, command data conversion', async (done) => {
    disposables.push(
      extHost.registerCodeActionsProvider(extension, defaultSelector, {
        provideCodeActions(): vscode.Command[] {
          return [
            { command: 'test1', title: 'Testing1' },
            { command: 'test2', title: 'Testing2' },
          ];
        },
      }),
    );

    setTimeout(async () => {
      const provider = monacoModes.CodeActionProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const value = (await provider.provideCodeActions(
        model,
        model.getFullModelRange(),
        {} as any,
        CancellationToken.None,
      ))!;
      expect(value.actions.length).toEqual(2);
      const [first, second] = value.actions;
      expect(first.title).toEqual('Testing1');
      expect((first as monaco.languages.CodeAction).command!.id).toEqual('test1');
      expect(second.title).toEqual('Testing2');
      expect((second as monaco.languages.CodeAction).command!.id).toEqual('test2');
      done();
    }, 0);
  });
  test('Quick Fix, code action data conversion', async (done) => {
    disposables.push(
      extHost.registerCodeActionsProvider(extension, defaultSelector, {
        provideCodeActions(): vscode.CodeAction[] {
          return [
            {
              title: 'Testing1',
              command: { title: 'Testing1Command', command: 'test1' },
              kind: types.CodeActionKind.Empty.append('test.scope'),
            },
          ];
        },
      }),
    );

    setTimeout(async () => {
      const provider = monacoModes.CodeActionProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const value = (await provider.provideCodeActions(
        model,
        model.getFullModelRange(),
        {} as any,
        CancellationToken.None,
      ))!;
      expect(value.actions.length).toEqual(1);
      const first = value.actions[0] as monaco.languages.CodeAction;
      expect(first.title).toEqual('Testing1');
      expect(first.command!.id).toEqual('test1');
      expect(first.command!.title).toEqual('Testing1Command');
      expect(first.kind).toEqual('test.scope');
      done();
    }, 0);
  });
  test("Cannot read property 'id' of undefined, #29469", async (done) => {
    disposables.push(
      extHost.registerCodeActionsProvider(
        extension,
        defaultSelector,
        new (class implements vscode.CodeActionProvider {
          provideCodeActions(): any {
            return [undefined, null, { command: 'test', title: 'Testing' }];
          }
        })(),
      ),
    );

    setTimeout(async () => {
      const provider = monacoModes.CodeActionProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const value = (await provider.provideCodeActions(
        model,
        model.getFullModelRange(),
        {} as any,
        CancellationToken.None,
      ))!;
      expect(value.actions.length).toEqual(1);
      done();
    }, 0);
  });

  // --- rename

  test('Rename', async (done) => {
    disposables.push(
      extHost.registerRenameProvider(
        defaultSelector,
        new (class implements vscode.RenameProvider {
          provideRenameEdits(): any {
            const edit = new types.WorkspaceEdit();
            edit.replace(model.uri, new types.Range(0, 0, 0, 0), 'testing');
            return edit;
          }
        })(),
      ),
    );

    setTimeout(async () => {
      const provider = monacoModes.RenameProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const value = (await provider.provideRenameEdits(
        model,
        { lineNumber: 1, column: 1 } as any,
        'newName',
        CancellationToken.None,
      ))!;
      expect((value as monaco.languages.WorkspaceEdit).edits.length).toEqual(1);
      done();
    }, 0);
  });

  // --- parameter hints

  test('Parameter Hints, evil provider', async (done) => {
    disposables.push(
      extHost.registerSignatureHelpProvider(
        defaultSelector,
        new (class implements vscode.SignatureHelpProvider {
          provideSignatureHelp(): vscode.SignatureHelp {
            return {
              signatures: [],
              activeParameter: 0,
              activeSignature: 0,
            };
          }
        })(),
        [],
      ),
    );

    setTimeout(async () => {
      const provider = monacoModes.SignatureHelpProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const value = await provider.provideSignatureHelp(
        model,
        { lineNumber: 1, column: 1 } as any,
        CancellationToken.None,
        { triggerKind: modes.SignatureHelpTriggerKind.Invoke, isRetrigger: false },
      );
      expect(value).toBeTruthy();
      done();
    }, 0);
  });

  // --- suggestions

  test('Suggest, CompletionList', async (done) => {
    disposables.push(
      extHost.registerCompletionItemProvider(
        defaultSelector,
        new (class implements vscode.CompletionItemProvider {
          provideCompletionItems(): any {
            return new types.CompletionList([new types.CompletionItem('hello') as any], true);
          }
        })(),
        [],
      ),
    );

    setTimeout(async () => {
      const provider = monacoModes.CompletionProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const value = (await provider.provideCompletionItems(
        model,
        { lineNumber: 1, column: 1 } as any,
        { triggerKind: 0 },
        CancellationToken.None,
      ))!;
      expect(value.incomplete).toEqual(true);
      done();
    }, 0);
  });

  test('Format Range, data conversion', async (done) => {
    disposables.push(
      extHost.registerDocumentRangeFormattingEditProvider(
        {
          id: 'test',
          displayName: 'Test Formatting Provider',
        } as unknown as IExtensionDescription,
        defaultSelector,
        new (class implements vscode.DocumentRangeFormattingEditProvider {
          provideDocumentRangeFormattingEdits(): any {
            return [new types.TextEdit(new types.Range(0, 0, 0, 0), 'testing')];
          }
        })(),
      ),
    );

    setTimeout(async () => {
      const provider = monacoModes.DocumentRangeFormattingEditProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const value = (await provider.provideDocumentRangeFormattingEdits(
        model,
        { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any,
        { insertSpaces: true, tabSize: 4 },
        CancellationToken.None,
      ))!;
      expect(value.length).toEqual(1);
      const [first] = value;
      expect(first.text).toEqual('testing');
      expect(first.range).toStrictEqual({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
      done();
    }, 0);
  });

  test('Format on Type, data conversion', async (done) => {
    disposables.push(
      extHost.registerOnTypeFormattingEditProvider(
        defaultSelector,
        new (class implements vscode.OnTypeFormattingEditProvider {
          provideOnTypeFormattingEdits(): any {
            // eslint-disable-next-line prefer-rest-params
            return [new types.TextEdit(new types.Range(0, 0, 0, 0), arguments[2])];
          }
        })(),
        [';'],
      ),
    );

    setTimeout(async () => {
      const provider = monacoModes.OnTypeFormattingEditProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const value = (await provider.provideOnTypeFormattingEdits(
        model,
        { lineNumber: 1, column: 2 } as any,
        ';',
        { insertSpaces: true, tabSize: 2 },
        CancellationToken.None,
      ))!;
      expect(value.length).toEqual(1);
      const [first] = value;
      expect(first.text).toEqual(';');
      expect(first.range).toStrictEqual({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
      done();
    }, 0);
  });
  test('Links, data conversion', async (done) => {
    disposables.push(
      extHost.registerDocumentLinkProvider(
        defaultSelector,
        new (class implements vscode.DocumentLinkProvider {
          provideDocumentLinks() {
            const link = new types.DocumentLink(new types.Range(0, 0, 1, 1), Uri.parse('foo:bar#3'));
            link.tooltip = 'tooltip';
            return [link];
          }
        })(),
      ),
    );

    setTimeout(async () => {
      const provider = monacoModes.LinkProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const { links } = (await provider.provideLinks(model, CancellationToken.None))!;
      expect(links.length).toEqual(1);
      const [first] = links;
      expect(first.url!.toString()).toEqual('foo:bar#3');
      expect(first.range).toStrictEqual({ startLineNumber: 1, startColumn: 1, endLineNumber: 2, endColumn: 2 });
      expect((first as any).tooltip).toEqual('tooltip');
      done();
    }, 0);
  });

  test('Document colors, data conversion', async (done) => {
    disposables.push(
      extHost.registerColorProvider(
        defaultSelector,
        new (class implements vscode.DocumentColorProvider {
          provideDocumentColors(): vscode.ColorInformation[] {
            return [new types.ColorInformation(new types.Range(0, 0, 0, 20), new types.Color(0.1, 0.2, 0.3, 0.4))];
          }
          provideColorPresentations(
            color: vscode.Color,
            context: { range: vscode.Range; document: vscode.TextDocument },
          ): vscode.ColorPresentation[] {
            return [];
          }
        })(),
      ),
    );

    setTimeout(async () => {
      const provider = monacoModes.ColorProviderRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const value = (await provider.provideDocumentColors(model, CancellationToken.None))!;
      expect(value.length).toEqual(1);
      const [first] = value;
      expect(first.color).toStrictEqual({ red: 0.1, green: 0.2, blue: 0.3, alpha: 0.4 });
      expect(first.range).toStrictEqual({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 21 });
      done();
    });
  });

  test('Selection Ranges, data conversion', async (done) => {
    disposables.push(
      extHost.registerSelectionRangeProvider(
        defaultSelector,
        new (class implements vscode.SelectionRangeProvider {
          provideSelectionRanges() {
            return [
              new types.SelectionRange(
                new types.Range(0, 10, 0, 18),
                new types.SelectionRange(new types.Range(0, 2, 0, 20)),
              ),
            ];
          }
        })(),
      ),
    );
    setTimeout(async () => {
      const provider = monacoModes.SelectionRangeRegistry.ordered(model)[0];
      expect(provider).toBeDefined();
      const ranges = await provider.provideSelectionRanges(
        model,
        [{ lineNumber: 1, column: 17 }] as any,
        CancellationToken.None,
      );
      expect(ranges?.length).toEqual(1);
      expect(ranges![0].length).toBeGreaterThan(1);
      done();
    });
  });

  test('change document model language', async () => {
    const uri = URI.parse('test://testing/file');
    extHostDocuments.$fireModelOpenedEvent({
      uri: uri.toString(),
      dirty: false,
      versionId: 1,
      languageId: 'plaintext',
      lines: [],
      eol: '\n',
    });
    await extHost.changeLanguage(uri.codeUri, 'a');
    const editorDocModelService: IEditorDocumentModelService = injector.get(IEditorDocumentModelService);
    const testDoc = await editorDocModelService.createModelReference(uri);
    expect(testDoc.instance.languageId).toBe('a');
  });

  // #region Semantic Tokens
  const tokenTypesLegend = [
    'comment',
    'string',
    'keyword',
    'number',
    'regexp',
    'operator',
    'namespace',
    'type',
    'struct',
    'class',
    'interface',
    'enum',
    'typeParameter',
    'function',
    'member',
    'macro',
    'variable',
    'parameter',
    'property',
    'label',
  ];
  const tokenModifiersLegend = [
    'declaration',
    'documentation',
    'readonly',
    'static',
    'abstract',
    'deprecated',
    'modification',
    'async',
  ];

  const textDocument = `Available token types:
  [comment] [string] [keyword] [number] [regexp] [operator] [namespace]
  [type] [struct] [class] [interface] [enum] [typeParameter] [function]
  [member] [macro] [variable] [parameter] [property] [label]

Available token modifiers:
  [type.declaration] [type.documentation] [type.member] [type.static]
  [type.abstract] [type.deprecated] [type.modification] [type.async]

Some examples:
  [class.static.token]     [type.static.abstract]
  [class.static.token]     [type.static]

  [struct]

  [function.private]

An error case:
  [notInLegend]`;

  const tokenTypes = new Map();
  const tokenModifiers = new Map();
  tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));
  tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));
  class TestSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    async provideDocumentSemanticTokens(document) {
      const allTokens = this._parseText(textDocument);
      const builder = new types.SemanticTokensBuilder();
      allTokens.forEach((token) => {
        builder.push(
          token.line,
          token.startCharacter,
          token.length,
          this._encodeTokenType(token.tokenType),
          this._encodeTokenModifiers(token.tokenModifiers),
        );
      });
      return builder.build();
    }
    _encodeTokenType(tokenType) {
      if (tokenTypes.has(tokenType)) {
        return tokenTypes.get(tokenType);
      } else if (tokenType === 'notInLegend') {
        return tokenTypes.size + 2;
      }
      return 0;
    }
    _encodeTokenModifiers(strTokenModifiers) {
      let result = 0;
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < strTokenModifiers.length; i++) {
        const tokenModifier = strTokenModifiers[i];
        if (tokenModifiers.has(tokenModifier)) {
          result = result | (1 << tokenModifiers.get(tokenModifier));
        } else if (tokenModifier === 'notInLegend') {
          result = result | (1 << (tokenModifiers.size + 2));
        }
      }
      return result;
    }
    _parseText(text) {
      const r: any[] = [];
      const lines = text.split(/\r\n|\r|\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let currentOffset = 0;
        do {
          const openOffset = line.indexOf('[', currentOffset);
          if (openOffset === -1) {
            break;
          }
          const closeOffset = line.indexOf(']', openOffset);
          if (closeOffset === -1) {
            break;
          }
          const tokenData = this._parseTextToken(line.substring(openOffset + 1, closeOffset));
          r.push({
            line: i,
            startCharacter: openOffset + 1,
            length: closeOffset - openOffset - 1,
            tokenType: tokenData.tokenType,
            tokenModifiers: tokenData.tokenModifiers,
          });
          currentOffset = closeOffset;
        } while (true);
      }
      return r;
    }
    _parseTextToken(text) {
      const parts = text.split('.');
      return {
        tokenType: parts[0],
        tokenModifiers: parts.slice(1),
      };
    }
  }
  const hostedProvider = new TestSemanticTokensProvider();

  it('registerDocumentSemanticTokensProvider should be work', async (done) => {
    const semanticLegend = new types.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
    monaco.languages.register({
      id: 'semanticLanguage',
      aliases: ['Semantic Language'],
      extensions: ['.semanticLanguage'],
    });

    const mockMainThreadFunc = jest.spyOn(mainThread, '$registerDocumentSemanticTokensProvider');

    disposables.push(
      extHost.registerDocumentSemanticTokensProvider({ language: 'semanticLanguage' }, hostedProvider, semanticLegend),
    );

    setTimeout(() => {
      expect(mockMainThreadFunc).toBeCalled();
      const uri = monaco.Uri.parse('file:///path/to/simple.semanticLanguage');
      const textModel = createModel('', 'semanticLanguage', uri);
      expect(monacoModes.DocumentSemanticTokensProviderRegistry.ordered(textModel as any).length).toBe(1);
      textModel.dispose();
      done();
    }, 0);
  });

  it('provideDocumentSemanticTokens should be work', async (done) => {
    const uri = monaco.Uri.parse('file:///path/to/simple1.semanticLanguage');
    const textModel = createModel('', 'semanticLanguage', uri);

    const provider = monacoModes.DocumentSemanticTokensProviderRegistry.ordered(textModel as any)[0];
    expect(provider).toBeDefined();

    const legend = provider.getLegend();
    expect(legend.tokenTypes).toEqual(tokenTypesLegend);
    expect(legend.tokenModifiers).toEqual(tokenModifiersLegend);

    const tokenSource = new monaco.CancellationTokenSource();
    const mockProvideFunc = jest.spyOn(hostedProvider, 'provideDocumentSemanticTokens');
    const tokens = await provider.provideDocumentSemanticTokens(textModel as any, null, tokenSource.token);

    expect(mockProvideFunc).toBeCalled();
    expect(tokens?.resultId).toBe('1');
    expect((tokens as types.SemanticTokens)?.data instanceof Uint32Array).toBeTruthy();
    done();
  });
  // #endregion Semantic Tokens
  // #region Call Hierarchy
  describe('CallHierarchy', () => {
    beforeAll(() => {
      injector.addProviders({
        token: IEditorDocumentModelService,
        useValue: {
          getModelReference: () => {},
          createModelReference: (uri) =>
            Promise.resolve({
              instance: {
                uri: model.uri,
                getMonacoModel: () => ({
                  uri: model.uri,
                  isTooLargeForSyncing: () => false,
                  getLanguageIdentifier: () => ({ language: 'plaintext' }),
                }),
              },
              dispose: jest.fn(),
            }),
        },
        override: true,
      });
    });

    afterAll(() => {
      injector.disposeOne(IEditorDocumentModelService);
    });

    test('registerCallHierarchyProvider should be work', async () => {
      class TestCallHierarchyProvider implements vscode.CallHierarchyProvider {
        prepareCallHierarchy(
          document: vscode.TextDocument,
          position: vscode.Position,
          token: vscode.CancellationToken,
        ): vscode.ProviderResult<vscode.CallHierarchyItem | vscode.CallHierarchyItem[]> {
          const range = new types.Range(0, 0, 0, 0);
          return new types.CallHierarchyItem(
            types.SymbolKind.Object,
            'test-name',
            'test-detail',
            document.uri,
            range,
            range,
          );
        }
        provideCallHierarchyIncomingCalls(
          item: vscode.CallHierarchyItem,
          token: vscode.CancellationToken,
        ): vscode.ProviderResult<vscode.CallHierarchyIncomingCall[]> {
          const range = new types.Range(0, 0, 0, 0);
          return [new types.CallHierarchyIncomingCall(item, [range])];
        }
        provideCallHierarchyOutgoingCalls(
          item: vscode.CallHierarchyItem,
          token: vscode.CancellationToken,
        ): vscode.ProviderResult<vscode.CallHierarchyOutgoingCall[]> {
          const range = new types.Range(0, 0, 0, 0);
          return [
            new types.CallHierarchyOutgoingCall(item, [range, range]),
            new types.CallHierarchyOutgoingCall(item, [range, range]),
          ];
        }
      }

      const callHierarchyService = injector.get<ICallHierarchyService>(ICallHierarchyService);
      const mockMainThreadFunc = jest.spyOn(mainThread, '$registerCallHierarchyProvider');

      extHost.registerCallHierarchyProvider('plaintext', new TestCallHierarchyProvider());

      await 0;

      expect(mockMainThreadFunc).toBeCalled();
      const prepareCallHierarchyItems = await callHierarchyService.prepareCallHierarchyProvider(
        model.uri,
        new Position(1, 1),
      );
      expect(prepareCallHierarchyItems.length).toBe(1);
      expect(prepareCallHierarchyItems[0].kind).toBe(types.SymbolKind.Object);
      const provideIncomingCalls = await callHierarchyService.provideIncomingCalls(prepareCallHierarchyItems[0]);
      expect(provideIncomingCalls).toBeDefined();
      expect(provideIncomingCalls!.length).toBe(1);
      expect(provideIncomingCalls![0].fromRanges.length).toBe(1);
      expect(provideIncomingCalls![0].from.kind).toBe(types.SymbolKind.Object);
      const provideOutgoingCalls = await callHierarchyService.provideOutgoingCalls(prepareCallHierarchyItems[0]);
      expect(provideOutgoingCalls).toBeDefined();
      expect(provideOutgoingCalls!.length).toBe(2);
      expect(provideOutgoingCalls![0].fromRanges.length).toBe(2);
      expect(provideOutgoingCalls![0].to.kind).toBe(types.SymbolKind.Object);
    });
  });
  // #endregion Semantic Tokens

  const textModel = createModel('test.a = "test"', 'test');
  const evaluatableExpressionService = injector.get<IEvaluatableExpressionService>(IEvaluatableExpressionService);
  const expressionProvider = {
    provideEvaluatableExpression(document, position) {
      const wordRange = new types.Range(position, position);
      return wordRange ? new types.EvaluatableExpression(wordRange, 'this is a expression for test') : undefined;
    },
  };

  // #region EvaluatableExpressionProvider
  it('registerEvaluatableExpressionProvider should be work', async (done) => {
    monaco.languages.register({
      id: 'test',
      extensions: ['.test'],
    });
    const extension = {
      name: 'test',
      id: 'evaluatableExpression.test',
      activate: () => {},
      deactivate: () => {},
      toJSON: () => {},
    };

    const mockedMainthreadFunc = jest.spyOn(mainThread, '$registerEvaluatableExpressionProvider');
    extHost.registerEvaluatableExpressionProvider(extension as any, 'test', expressionProvider);

    setTimeout(() => {
      expect(mockedMainthreadFunc).toBeCalled();
      expect(evaluatableExpressionService.hasEvaluatableExpressProvider(textModel)).toBeTruthy();
      done();
    }, 0);
  });

  it('provideEvaluatableExpression should be work', async (done) => {
    const providers = evaluatableExpressionService.getSupportedEvaluatableExpressionProvider(textModel);

    expect(providers.length).toBe(1);
    expect(providers[0].provideEvaluatableExpression).toBeDefined();

    const pos = new monaco.Position(1, 7);

    const mockProvideFunc = jest.spyOn(expressionProvider, 'provideEvaluatableExpression');
    const tokenSource = new monaco.CancellationTokenSource();
    const expression = await providers[0].provideEvaluatableExpression(textModel, pos, tokenSource.token);

    expect(mockProvideFunc).toBeCalled();
    expect(expression?.range).toEqual({
      startLineNumber: 1,
      startColumn: 7,
      endLineNumber: 1,
      endColumn: 7,
    });
    expect(expression?.expression).toBe('this is a expression for test');
    done();
  });
  // #endregion EvaluatableExpressionProvider

  // #region registerLinkedEditingRangeProvider
  it('registerLinkedEditingRangeProvider', async () => {
    class TestLinkedEditingRangeProvider implements vscode.LinkedEditingRangeProvider {
      provideLinkedEditingRanges(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
      ): vscode.ProviderResult<vscode.LinkedEditingRanges> {
        return {
          ranges: [new types.Range(0, 0, 0, 1)],
          wordPattern: /[a-eA-E]+/,
        };
      }
    }
    const mockMainThreadFunc = jest.spyOn(mainThread, '$registerLinkedEditingRangeProvider');

    extHost.registerLinkedEditingRangeProvider(mockService({}), 'plaintext', new TestLinkedEditingRangeProvider());

    await 0;

    expect(mockMainThreadFunc).toBeCalled();
    expect(mockMainThreadFunc).toBeCalledWith(expect.anything(), [{ $serialized: true, language: 'plaintext' }]);
  });
  // #endregion registerLinkedEditingRangeProvider
  // #region registerInlayHintsProvider
  it('registerInlayHintsProvider', async () => {
    class TestInlayHintsProvider implements vscode.InlayHintsProvider {
      provideInlayHints(): vscode.ProviderResult<vscode.InlayHint[]> {
        return [
          {
            text: 'sumi',
            position: new types.Position(0, 0),
          },
        ];
      }
    }
    const mockMainThreadFunc = jest.spyOn(mainThread, '$registerInlayHintsProvider');
    extHost.registerInlayHintsProvider(mockService({}), 'plaintext', new TestInlayHintsProvider());
    await 0;
    expect(mockMainThreadFunc).toBeCalled();
    expect(mockMainThreadFunc).toBeCalledWith(
      expect.anything(),
      [{ $serialized: true, language: 'plaintext' }],
      undefined,
    );
  });
  // #endregion registerInlayHintsProvider
});
