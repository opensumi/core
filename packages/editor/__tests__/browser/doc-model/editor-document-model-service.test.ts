import * as md5 from 'md5';
import { uniqueId } from 'lodash';
import { URI, IEventBus } from '@ali/ide-core-browser';

import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { createMockedMonaco } from '@ali/ide-monaco/lib/__mocks__/monaco';
import { EditorDocumentModelServiceImpl, EditorDocumentModelContentRegistryImpl } from '@ali/ide-editor/lib/browser/doc-model/main';
import { useMockStorage } from '@ali/ide-core-browser/lib/mocks/storage';
import { IEditorDocumentModelContentRegistry, IEditorDocumentModelService, EmptyDocCacheImpl } from '@ali/ide-editor/lib/browser';
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
  });

  afterEach(() => {
    delete (global as any).monaco;
  });

  it('chooseEncoding', async (done) => {
    const editorDocModelRegistry: IEditorDocumentModelContentRegistry = injector.get(IEditorDocumentModelContentRegistry);
    const editorDocModelService: IEditorDocumentModelService = injector.get(IEditorDocumentModelService);
    editorDocModelRegistry.registerEditorDocumentModelContentProvider(TestEditorDocumentProvider);

    const testCodeUri = new URI('test://testUri1');
    const testDoc1 = await editorDocModelService.createModelReference(testCodeUri);
    expect(testDoc1.instance.encoding).toBe('utf8');
    await editorDocModelService.changeModelEncoding(testCodeUri, 'gbk');
    expect(testDoc1.instance.encoding).toBe('gbk');

    done();
  });
});
