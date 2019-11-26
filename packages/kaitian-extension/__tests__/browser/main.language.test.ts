import { ExtHostLanguages } from '../../src/hosted/api/vscode/ext.host.language';
import { MainThreadLanguages } from '../../src/browser/vscode/api/main.thread.language';
import URI from 'vscode-uri';
import * as vscode from 'vscode';
import * as types from '../../src/common/vscode/ext-types';
import * as modes from '../../src/common/vscode/model.api';

import { RPCProtocol } from '@ali/ide-connection';
import { Emitter, CancellationToken, MonacoService, CommandRegistry, CommandRegistryImpl, DisposableCollection } from '@ali/ide-core-browser';
import { ExtensionDocumentDataManagerImpl } from '../../src/hosted/api/vscode/doc';
import { ExtHostAPIIdentifier, MainThreadAPIIdentifier } from '../../src/common/vscode';
import { ExtHostCommands } from '../../src/hosted/api/vscode/ext.host.command';
import { MainThreadCommands } from '../../src/browser/vscode/api/main.thread.commands';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockedMonacoService } from '@ali/ide-monaco/lib/__mocks__/monaco.service.mock';
import { mockFeatureProviderRegistry, CodeLensProvider, DefinitionProvider, ImplementationProvider, TypeDefinitionProvider, ReferenceProvider, DocumentHighlightProvider, DocumentRangeFormattingEditProvider, OnTypeFormattingEditProvider, DocumentColorProvider, LinkProvider, SelectionRangeProvider, HoverProvider, CodeActionProvider, RenameProvider, SignatureHelpProvider, CompletionItemProvider } from '@ali/ide-monaco/lib/__mocks__/monaco/langauge';

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
let model: monaco.editor.ITextModel;

// tslint:disable new-parens
describe('ExtHostLanguageFeatures', () => {
  const injector = createBrowserInjector([]);
  (global as any).amdLoader = { require: null };
  let monacoService: MonacoService;

  injector.addProviders(
    {
      token: MonacoService,
      useClass: MockedMonacoService,
    },
  );

  (global as any).amdLoader = { require: null };

  beforeAll(async (done) => {
    monacoService = injector.get(MonacoService);
    await monacoService.loadMonaco();
    model = monaco.editor.createModel([
      'This is the first line',
      'This is the second line',
      'This is the third line',
    ].join('\n'), undefined, monaco.Uri.parse('far://testing/file.a'));
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

    extHost = new ExtHostLanguages(rpcProtocolExt, extHostDocuments, commands);
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostLanguages, extHost);

    mainThread = rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadLanguages, injector.get(MainThreadLanguages, [rpcProtocolMain]));

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

  // TODO  --- outline
  // --- codelens
  test('CodeLens, evil provider', async (done) => {

    disposables.push(extHost.registerCodeLensProvider(defaultSelector, new class implements vscode.CodeLensProvider {
      provideCodeLenses(): any {
        throw new Error('evil');
      }
    }));
    disposables.push(extHost.registerCodeLensProvider(defaultSelector, new class implements vscode.CodeLensProvider {
      provideCodeLenses() {
        return [new types.CodeLens(new types.Range(0, 0, 0, 0))];
      }
    }));
    setTimeout(async () => {
      const provider: CodeLensProvider = mockFeatureProviderRegistry.get('registerCodeLensProvider');
      expect(provider).toBeDefined();
      const value = (await provider.provideCodeLenses(model, CancellationToken.None))!;
      expect(value.length).toEqual(1);
      done();
    }, 0);
  });

  test('CodeLens, do not resolve a resolved lens', async (done) => {
    disposables.push(extHost.registerCodeLensProvider(defaultSelector, new class implements vscode.CodeLensProvider {
      provideCodeLenses(): any {
        return [new types.CodeLens(
          new types.Range(0, 0, 0, 0),
          { command: 'id', title: 'Title' })];
      }
      resolveCodeLens(): any {
        console.warn('do not resolve');
      }
    }));
    setTimeout(async () => {
      const provider: CodeLensProvider = mockFeatureProviderRegistry.get('registerCodeLensProvider');
      const value = (await provider.provideCodeLenses(model, CancellationToken.None))!;
      expect(value.length).toEqual(1);
      const symbol = value[0];
      expect(symbol!.command!.id).toEqual('id');
      expect(symbol!.command!.title).toEqual('Title');
      done();
    }, 0);
  });
  test('CodeLens, missing command', async (done) => {
    disposables.push(extHost.registerCodeLensProvider(defaultSelector, new class implements vscode.CodeLensProvider {
      provideCodeLenses() {
        return [new types.CodeLens(new types.Range(0, 0, 0, 0))];
      }
    }));
    setTimeout(async () => {
      const provider: CodeLensProvider = mockFeatureProviderRegistry.get('registerCodeLensProvider');
      const value = (await provider.provideCodeLenses(model, CancellationToken.None))!;
      expect(value.length).toEqual(1);
      const symbol = value[0];
      expect(symbol!.command).toBeUndefined();
      done();
    }, 0);
  });
  test('Definition, data conversion', async (done) => {
    disposables.push(extHost.registerDefinitionProvider(defaultSelector, new class implements vscode.DefinitionProvider {
      provideDefinition(): any {
        return [new types.Location(model.uri, new types.Range(1, 2, 3, 4))];
      }
    }));
    setTimeout(async () => {
      const provider: DefinitionProvider = mockFeatureProviderRegistry.get('registerDefinitionProvider');
      expect(provider).toBeDefined();
      const value = (await provider.provideDefinition(model, { lineNumber: 1, column: 1 } as any, CancellationToken.None))!;
      // @ts-ignore
      expect(value.length).toEqual(1);
      expect(value[0].range).toStrictEqual({ startLineNumber: 2, startColumn: 3, endLineNumber: 4, endColumn: 5 });
      console.log('Definition Test', value);
      done();
    }, 0);
  });

  // TODO 实现 Declaration
  // test('Declaration, data conversion', async () => {

  // });
  test('Implementation, data conversion', async (done) => {
    disposables.push(extHost.registerImplementationProvider(defaultSelector, new class implements vscode.ImplementationProvider {
      provideImplementation(): any {
        return [new types.Location(model.uri, new types.Range(1, 2, 3, 4))];
      }
    }));
    setTimeout(async () => {
      const provider: ImplementationProvider = mockFeatureProviderRegistry.get('registerImplementationProvider');
      expect(provider).toBeDefined();
      const value = await provider.provideImplementation(model, { lineNumber: 1, column: 1 } as any, CancellationToken.None);
      // @ts-ignore
      expect(value!.length).toEqual(1);
      expect(value![0].range).toStrictEqual({ startLineNumber: 2, startColumn: 3, endLineNumber: 4, endColumn: 5 });
      console.log('Implementation Test', value);
      done();
    }, 0);
  });
  test('Type Definition, data conversion', async (done) => {
    disposables.push(extHost.registerTypeDefinitionProvider(defaultSelector, new class implements vscode.TypeDefinitionProvider {
      provideTypeDefinition(): any {
        return [new types.Location(model.uri, new types.Range(1, 2, 3, 4))];
      }
    }));
    setTimeout(async () => {
      const provider: TypeDefinitionProvider = mockFeatureProviderRegistry.get('registerTypeDefinitionProvider');
      expect(provider).toBeDefined();
      const value = await provider.provideTypeDefinition(model, { lineNumber: 1, column: 1 } as any, CancellationToken.None);
      // @ts-ignore
      expect(value!.length).toEqual(1);
      expect(value![0].range).toStrictEqual({ startLineNumber: 2, startColumn: 3, endLineNumber: 4, endColumn: 5 });
      console.log('Type Definition Test', value);
      done();
    }, 0);
  });
  test('HoverProvider, word range at pos', async (done) => {
    disposables.push(extHost.registerHoverProvider(defaultSelector, new class implements vscode.HoverProvider {
      provideHover(): any {
        return new types.Hover('Hello');
      }
    }));
    setTimeout(async () => {
      const provider: HoverProvider = mockFeatureProviderRegistry.get('registerHoverProvider');
      expect(provider).toBeDefined();
      const value = (await provider.provideHover(model, { lineNumber: 1, column: 1 } as any, CancellationToken.None))!;
      expect(value.range).toStrictEqual({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 5 });
      done();
    }, 0);
  });
  test('HoverProvider, given range', async (done) => {
    disposables.push(extHost.registerHoverProvider(defaultSelector, new class implements vscode.HoverProvider {
      provideHover(): any {
        return new types.Hover('Hello', new types.Range(3, 0, 8, 7));
      }
    }));
    setTimeout(async () => {
      const provider: HoverProvider = mockFeatureProviderRegistry.get('registerHoverProvider');
      expect(provider).toBeDefined();
      const value = (await provider.provideHover(model, { lineNumber: 1, column: 1 } as any, CancellationToken.None))!;
      expect(value.range).toStrictEqual({ startLineNumber: 4, startColumn: 1, endLineNumber: 9, endColumn: 8 });
      done();
    }, 0);
  });

  test('Occurrences, data conversion', async (done) => {
    disposables.push(extHost.registerDocumentHighlightProvider(defaultSelector, new class implements vscode.DocumentHighlightProvider {
      provideDocumentHighlights(): any {
        return [new types.DocumentHighlight(new types.Range(0, 0, 0, 4))];
      }
    }));
    setTimeout(async () => {
      const provider: DocumentHighlightProvider = mockFeatureProviderRegistry.get('registerDocumentHighlightProvider');
      expect(provider).toBeDefined();
      const value = await provider.provideDocumentHighlights(model, { lineNumber: 1, column: 2 } as any, CancellationToken.None);
      // @ts-ignore
      expect(value!.length).toEqual(1);
      expect(value![0].range).toStrictEqual({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 5 });
      expect(value![0].kind).toEqual(modes.DocumentHighlightKind.Text);
      done();
    }, 0);
  });

  // --- references

  test('References, data conversion', async (done) => {
    disposables.push(extHost.registerReferenceProvider(defaultSelector, new class implements vscode.ReferenceProvider {
      provideReferences(): any {
        return [new types.Location(model.uri, new types.Position(0, 0))];
      }
    }));
    setTimeout(async () => {
      const provider: ReferenceProvider = mockFeatureProviderRegistry.get('registerReferenceProvider');
      expect(provider).toBeDefined();
      // FIXME 第三个参数context mock
      const value = await provider.provideReferences(model, { lineNumber: 1, column: 2 } as any, {} as any, CancellationToken.None);
      expect(value!.length).toEqual(1);
      expect(value![0].range).toStrictEqual({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
      expect(value![0].uri.toString()).toEqual(model.uri.toString());
      done();
    }, 0);
  });

  // --- quick fix

  test('Quick Fix, command data conversion', async (done) => {
    disposables.push(extHost.registerCodeActionsProvider(defaultSelector, {
      provideCodeActions(): vscode.Command[] {
        return [
          { command: 'test1', title: 'Testing1' },
          { command: 'test2', title: 'Testing2' },
        ];
      },
    }));

    setTimeout(async () => {
      const provider: CodeActionProvider = mockFeatureProviderRegistry.get('registerCodeActionProvider');
      expect(provider).toBeDefined();
      const value = (await provider.provideCodeActions(model, model.getFullModelRange(), {} as any, CancellationToken.None))!;
      expect(value.length).toEqual(2);
      const [first, second] = value;
      expect(first.title).toEqual('Testing1');
      expect((first as monaco.languages.CodeAction).command!.id).toEqual('test1');
      expect(second.title).toEqual('Testing2');
      expect((second as monaco.languages.CodeAction).command!.id).toEqual('test2');
      done();
    }, 0);
  });
  test('Quick Fix, code action data conversion', async (done) => {
    disposables.push(extHost.registerCodeActionsProvider(defaultSelector, {
      provideCodeActions(): vscode.CodeAction[] {
        return [
          {
            title: 'Testing1',
            command: { title: 'Testing1Command', command: 'test1' },
            kind: types.CodeActionKind.Empty.append('test.scope'),
          },
        ];
      },
    }));

    setTimeout(async () => {
      const provider: CodeActionProvider = mockFeatureProviderRegistry.get('registerCodeActionProvider');
      expect(provider).toBeDefined();
      const value = (await provider.provideCodeActions(model, model.getFullModelRange(), {} as any, CancellationToken.None))!;
      expect(value.length).toEqual(1);
      const first = value[0] as monaco.languages.CodeAction;
      expect(first.title).toEqual('Testing1');
      expect(first.command!.id).toEqual('test1');
      expect(first.command!.title).toEqual('Testing1Command');
      expect(first.kind).toEqual('test.scope');
      done();
    }, 0);
  });
  test('Cannot read property \'id\' of undefined, #29469', async (done) => {
    disposables.push(extHost.registerCodeActionsProvider(defaultSelector, new class implements vscode.CodeActionProvider {
      provideCodeActions(): any {
        return [
          undefined,
          null,
          { command: 'test', title: 'Testing' },
        ];
      }
    }));

    setTimeout(async () => {
      const provider: CodeActionProvider = mockFeatureProviderRegistry.get('registerCodeActionProvider');
      expect(provider).toBeDefined();
      const value = (await provider.provideCodeActions(model, model.getFullModelRange(), {} as any, CancellationToken.None))!;
      expect(value.length).toEqual(1);
      done();
    }, 0);
  });

  // --- rename

  test('Rename', async (done) => {
    disposables.push(extHost.registerRenameProvider(defaultSelector, new class implements vscode.RenameProvider {
      provideRenameEdits(): any {
        const edit = new types.WorkspaceEdit();
        edit.replace(model.uri, new types.Range(0, 0, 0, 0), 'testing');
        return edit;
      }
    }));

    setTimeout(async () => {
      const provider: RenameProvider = mockFeatureProviderRegistry.get('registerRenameProvider');
      expect(provider).toBeDefined();
      const value = (await provider.provideRenameEdits(model, { lineNumber: 1, column: 1 } as any, 'newName', CancellationToken.None))!;
      expect((value as monaco.languages.WorkspaceEdit).edits.length).toEqual(1);
      done();
    }, 0);
  });

  // --- parameter hints

  test('Parameter Hints, evil provider', async (done) => {
    disposables.push(extHost.registerSignatureHelpProvider(defaultSelector, new class implements vscode.SignatureHelpProvider {
      provideSignatureHelp(): vscode.SignatureHelp {
        return {
          signatures: [],
          activeParameter: 0,
          activeSignature: 0,
        };
      }
    }, []));

    setTimeout(async () => {
      const provider: SignatureHelpProvider = mockFeatureProviderRegistry.get('registerSignatureHelpProvider');
      expect(provider).toBeDefined();
      const value = await provider.provideSignatureHelp(model, { lineNumber: 1, column: 1 } as any, CancellationToken.None, { triggerKind: modes.SignatureHelpTriggerKind.Invoke, isRetrigger: false });
      expect(value).toBeTruthy();
      done();
    }, 0);
  });

  // --- suggestions

  test('Suggest, CompletionList', async (done) => {
    disposables.push(extHost.registerCompletionItemProvider(defaultSelector, new class implements vscode.CompletionItemProvider {
      provideCompletionItems(): any {
        return new types.CompletionList([new types.CompletionItem('hello') as any], true);
      }
    }, []));

    setTimeout(async () => {
      const provider: CompletionItemProvider = mockFeatureProviderRegistry.get('registerCompletionItemProvider');
      expect(provider).toBeDefined();
      const value = (await provider.provideCompletionItems(model, { lineNumber: 1, column: 1 } as any, { triggerKind: 0 }, CancellationToken.None))!;
      expect(value.incomplete).toEqual(true);
      done();
    }, 0);
  });
  // TODO 实现 registerDocumentFormattingEditProvider api
  // test('Format Doc, data conversion', async () => {

  // });
  // test('Format Doc, evil provider', async (done) => {

  // });
  // test('Format Doc, order', async (done) => {

  // });
  test('Format Range, data conversion', async (done) => {
    disposables.push(extHost.registerDocumentRangeFormattingEditProvider('test', defaultSelector, new class implements vscode.DocumentRangeFormattingEditProvider {
      provideDocumentRangeFormattingEdits(): any {
        return [new types.TextEdit(new types.Range(0, 0, 0, 0), 'testing')];
      }
    }));

    setTimeout(async () => {
      const provider: DocumentRangeFormattingEditProvider = mockFeatureProviderRegistry.get('registerDocumentRangeFormattingEditProvider');
      expect(provider).toBeDefined();
      const value = (await provider.provideDocumentRangeFormattingEdits(model, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any, { insertSpaces: true, tabSize: 4 }, CancellationToken.None))!;
      expect(value.length).toEqual(1);
      const [first] = value;
      expect(first.text).toEqual('testing');
      expect(first.range).toStrictEqual({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
      done();
    }, 0);
  });
  // TODO doc
  // test('Format Range, + format_doc', async (done) => {

  // });

  test('Format on Type, data conversion', async (done) => {
    disposables.push(extHost.registerOnTypeFormattingEditProvider(defaultSelector, new class implements vscode.OnTypeFormattingEditProvider {
      provideOnTypeFormattingEdits(): any {
        return [new types.TextEdit(new types.Range(0, 0, 0, 0), arguments[2])];
      }
    }, [';']));

    setTimeout(async () => {
      const provider: OnTypeFormattingEditProvider = mockFeatureProviderRegistry.get('registerOnTypeFormattingEditProvider');
      expect(provider).toBeDefined();
      const value = (await provider.provideOnTypeFormattingEdits(model, { lineNumber: 1, column: 2 } as any, ';', { insertSpaces: true, tabSize: 2 }, CancellationToken.None))!;
      expect(value.length).toEqual(1);
      const [first] = value;
      expect(first.text).toEqual(';');
      expect(first.range).toStrictEqual({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
      done();
    }, 0);
  });
  test('Links, data conversion', async (done) => {
    disposables.push(extHost.registerDocumentLinkProvider(defaultSelector, new class implements vscode.DocumentLinkProvider {
      provideDocumentLinks() {
        const link = new types.DocumentLink(new types.Range(0, 0, 1, 1), URI.parse('foo:bar#3'));
        link.tooltip = 'tooltip';
        return [link];
      }
    }));

    setTimeout(async () => {
      const provider: LinkProvider = mockFeatureProviderRegistry.get('registerLinkProvider');
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
    disposables.push(extHost.registerColorProvider(defaultSelector, new class implements vscode.DocumentColorProvider {
      provideDocumentColors(): vscode.ColorInformation[] {
        return [new types.ColorInformation(new types.Range(0, 0, 0, 20), new types.Color(0.1, 0.2, 0.3, 0.4))];
      }
      provideColorPresentations(color: vscode.Color, context: { range: vscode.Range, document: vscode.TextDocument }): vscode.ColorPresentation[] {
        return [];
      }
    }));

    setTimeout(async () => {
      const provider: DocumentColorProvider = mockFeatureProviderRegistry.get('registerColorProvider');
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
    disposables.push(extHost.registerSelectionRangeProvider(defaultSelector, new class implements vscode.SelectionRangeProvider {
      provideSelectionRanges() {
        return [
          new types.SelectionRange(new types.Range(0, 10, 0, 18), new types.SelectionRange(new types.Range(0, 2, 0, 20))),
        ];
      }
    }));
    setTimeout(async () => {
      const provider: SelectionRangeProvider = mockFeatureProviderRegistry.get('registerSelectionRangeProvider');
      expect(provider).toBeDefined();
      const ranges = await provider.provideSelectionRanges(model, [{ lineNumber: 1, column: 17 }] as any, CancellationToken.None);
      expect(ranges.length).toEqual(1);
      expect(ranges[0].length).toBeGreaterThan(1);
      done();
    });
  });

});
