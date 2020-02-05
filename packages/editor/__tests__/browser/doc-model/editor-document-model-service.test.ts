import * as md5 from 'md5';
import { uniqueId } from 'lodash';
import { URI, IEventBus } from '@ali/ide-core-browser';

import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { createMockedMonaco } from '@ali/ide-monaco/lib/__mocks__/monaco';
import { EditorDocumentModelServiceImpl, EditorDocumentModelContentRegistryImpl } from '@ali/ide-editor/lib/browser/doc-model/main';
import { useMockStorage } from '@ali/ide-core-browser/lib/mocks/storage';
import { IEditorDocumentModelContentRegistry, IEditorDocumentModelService, EmptyDocCacheImpl, EditorDocumentModelCreationEvent } from '@ali/ide-editor/lib/browser';
import { TestEditorDocumentProvider } from '../test-providers';
import { IDocPersistentCacheProvider } from '@ali/ide-editor';

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
    (global as any).monaco = createMockedMonaco() as any;
    useMockStorage(injector);
    const editorDocModelRegistry: IEditorDocumentModelContentRegistry = injector.get(IEditorDocumentModelContentRegistry);
    editorDocModelRegistry.registerEditorDocumentModelContentProvider(TestEditorDocumentProvider);
  });

  afterAll(() => {
    delete (global as any).monaco;
  });

  it('chooseEncoding', async (done) => {

    const editorDocModelService: IEditorDocumentModelService = injector.get(IEditorDocumentModelService);

    const testCodeUri = new URI('test://testUri1');
    const testDoc1 = await editorDocModelService.createModelReference(testCodeUri);
    expect(testDoc1.instance.encoding).toBe('utf8');
    await editorDocModelService.changeModelOptions(testCodeUri, { encoding: 'gbk' , langaugeId: 'javascript'});
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
