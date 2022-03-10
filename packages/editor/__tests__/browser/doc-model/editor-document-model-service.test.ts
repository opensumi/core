import { URI, IEventBus } from '@opensumi/ide-core-browser';
import { useMockStorage } from '@opensumi/ide-core-browser/__mocks__/storage';
import { IDocPersistentCacheProvider } from '@opensumi/ide-editor';
import {
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelService,
  EmptyDocCacheImpl,
  EditorDocumentModelCreationEvent,
} from '@opensumi/ide-editor/lib/browser';
import {
  EditorDocumentModelServiceImpl,
  EditorDocumentModelContentRegistryImpl,
} from '@opensumi/ide-editor/lib/browser/doc-model/main';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { TestEditorDocumentProvider } from '../test-providers';


describe('EditorDocumentModelService', () => {
  let injector: MockInjector;

  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.addProviders(
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
    );
    useMockStorage(injector);
    const editorDocModelRegistry: IEditorDocumentModelContentRegistry = injector.get(
      IEditorDocumentModelContentRegistry,
    );
    editorDocModelRegistry.registerEditorDocumentModelContentProvider(TestEditorDocumentProvider);
  });

  it('chooseEncoding', async (done) => {
    monaco.languages.register({
      id: 'javascript',
      aliases: ['JavaScript'],
      extensions: ['.js'],
    });
    const editorDocModelService: IEditorDocumentModelService = injector.get(IEditorDocumentModelService);

    const testCodeUri = new URI('test://testUri1.js');
    const testDoc1 = await editorDocModelService.createModelReference(testCodeUri);
    expect(testDoc1.instance.encoding).toBe('utf8');
    await editorDocModelService.changeModelOptions(testCodeUri, { encoding: 'gbk', languageId: 'javascript' });
    expect(testDoc1.instance.encoding).toBe('gbk');
    expect(testDoc1.instance.languageId).toBe('javascript');

    done();
  });

  it('create doc', async (done) => {
    const createFn = jest.fn();
    const disposer = injector.get<IEventBus>(IEventBus).on(EditorDocumentModelCreationEvent, createFn);

    const editorDocModelService: IEditorDocumentModelService = injector.get(IEditorDocumentModelService);

    const testCodeUri = new URI('test://testUri2');
    const testDoc2 = await editorDocModelService.createModelReference(testCodeUri);
    expect(createFn).toBeCalledTimes(1);

    disposer.dispose();
    done();
  });
});
