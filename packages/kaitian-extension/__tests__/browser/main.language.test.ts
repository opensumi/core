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
import { mockFeatureProviderRegistry, CodeLensProvider, DefinitionProvider, ImplementationProvider, TypeDefinitionProvider, ReferenceProvider, DocumentHighlightProvider } from '@ali/ide-monaco/lib/__mocks__/monaco/langauge';

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
  test('CodeLens should work', async (done) => {
    disposables.push(extHost.registerCodeLensProvider(defaultSelector, new class implements vscode.CodeLensProvider {
      provideCodeLenses() {
        return [new types.CodeLens(
          new types.Range(0, 0, 0, 0),
          { command: 'id', title: 'Title' })];
      }
      resolveCodeLens(): any {
        console.log('resolve codelens');
      }
    }));
    // TODO 通信保障主进程已被调用
    setTimeout(async () => {
      const provider: CodeLensProvider = mockFeatureProviderRegistry.get('registerCodeLensProvider');
      expect(provider).toBeDefined();
      const value = await provider.provideCodeLenses(model, CancellationToken.None);
      expect(value).toBeDefined();
      console.log('CodeLens Test', value);
      done();
    }, 0);
  });
  test('CodeLens, do not resolve a resolved lens', async () => {

  });
  test('CodeLens, missing command', async () => {

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
      const value = await provider.provideDefinition(model, {lineNumber: 1, column: 1} as any, CancellationToken.None);
      // @ts-ignore
      expect(value!.length).toEqual(1);
      expect(value![0].range).toStrictEqual({ startLineNumber: 2, startColumn: 3, endLineNumber: 4, endColumn: 5 });
      console.log('Definition Test', value);
      done();
    }, 0);
  });
  test('Definition, one or many', async () => {

  });
  test('Definition, registration order', async () => {

  });
  test('Definition, evil provider', async () => {

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
      const value = await provider.provideImplementation(model, {lineNumber: 1, column: 1} as any, CancellationToken.None);
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
      const value = await provider.provideTypeDefinition(model, {lineNumber: 1, column: 1} as any, CancellationToken.None);
      // @ts-ignore
      expect(value!.length).toEqual(1);
      expect(value![0].range).toStrictEqual({ startLineNumber: 2, startColumn: 3, endLineNumber: 4, endColumn: 5 });
      console.log('Type Definition Test', value);
      done();
    }, 0);
  });
  test('HoverProvider, word range at pos', async () => {

  });
  test('HoverProvider, given range', async () => {

  });
  test('HoverProvider, registration order', async () => {

  });
  test('HoverProvider, evil provider', async () => {

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
      const value = await provider.provideDocumentHighlights(model, {lineNumber: 1, column: 2} as any, CancellationToken.None);
      // @ts-ignore
      expect(value!.length).toEqual(1);
      expect(value![0].range).toStrictEqual({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 5 });
      expect(value![0].kind).toEqual(modes.DocumentHighlightKind.Text);
      console.log('Occurrences Test', value);
      done();
    }, 0);
  });
  test('Occurrences, order 1/2', async () => {

  });
  test('Occurrences, order 2/2', async () => {

  });
  test('Occurrences, evil provider', async () => {

  });
  test('References, registration order', async () => {

  });
  test.only('References, data conversion', async (done) => {
    disposables.push(extHost.registerReferenceProvider(defaultSelector, new class implements vscode.ReferenceProvider {
      provideReferences(): any {
        return [new types.Location(model.uri, new types.Position(0, 0))];
      }
    }));
    setTimeout(async () => {
      const provider: ReferenceProvider = mockFeatureProviderRegistry.get('registerReferenceProvider');
      expect(provider).toBeDefined();
      // FIXME 第三个参数context mock
      const value = await provider.provideReferences(model, {lineNumber: 1, column: 2} as any, {} as any, CancellationToken.None);
      // @ts-ignore
      expect(value!.length).toEqual(1);
      expect(value![0].range).toStrictEqual({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
      expect(value![0].uri.toString()).toEqual(model.uri.toString());
      console.log('References Test', value);
      done();
    }, 0);
  });
  test('References, evil provider', async () => {

  });
  test('Quick Fix, command data conversion', async () => {

  });
  test('Quick Fix, code action data conversion', async () => {

  });
  test('Cannot read property \'id\' of undefined, #29469', async () => {

  });
  test('Quick Fix, evil provider', async () => {

  });
  test('Navigate types, evil provider', async () => {

  });
  test('Rename, evil provider 0/2', async () => {

  });
  test('Rename, evil provider 1/2', async () => {

  });
  test('Rename, evil provider 2/2', async () => {

  });
  test('Rename, ordering', async () => {

  });
  test('Parameter Hints, order', async () => {

  });
  test('Parameter Hints, evil provider', async () => {

  });
  test('Suggest, order 1/3', async () => {

  });
  test('Suggest, order 2/3', async () => {

  });
  test('Suggest, order 2/3', async () => {

  });
  test('Suggest, evil provider', async () => {

  });
  test('Suggest, CompletionList', async () => {

  });
  test('Format Doc, data conversion', async () => {

  });
  test('Format Doc, evil provider', async () => {

  });
  test('Format Doc, order', async () => {

  });
  test('Format Range, data conversion', async () => {

  });
  test('Format Range, + format_doc', async () => {

  });
  test('Format Range, evil provider', async () => {

  });
  test('Format on Type, data conversion', async () => {

  });
  test('Links, data conversion', async () => {

  });
  test('Links, evil provider', async () => {

  });
  test('Document colors, data conversion', async () => {

  });
  test('Selection Ranges, data conversion', async () => {

  });
  test('Selection Ranges, bad data', async () => {

  });

});
