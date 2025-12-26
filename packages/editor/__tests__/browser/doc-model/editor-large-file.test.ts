import { PreferenceService, URI } from '@opensumi/ide-core-browser';
import { useMockStorage } from '@opensumi/ide-core-browser/__mocks__/storage';
import { Emitter } from '@opensumi/ide-core-common';
import { IHashCalculateService } from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';
import { EmptyDocCacheImpl } from '@opensumi/ide-editor/lib/browser/doc-cache';
import { monaco as mockedMonacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import {
  EditorDocumentModel,
  EditorDocumentModelContentRegistryImpl,
  EditorDocumentModelServiceImpl,
} from '../../../src/browser/doc-model/main';
import {
  IEditorDocumentModelContentProvider,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelService,
} from '../../../src/browser/doc-model/types';
import { IDocPersistentCacheProvider } from '../../../src/common';

jest.mock('@opensumi/ide-monaco/lib/browser/monaco-api', () => {
  const mockMonacoHelper = require('../../../../monaco/__mocks__/monaco');
  const mMonaco = mockMonacoHelper.createMockedMonaco();
  return {
    monaco: mMonaco,
    URI: mMonaco.Uri,
    __esModule: true, // Important for default imports if any, though here it's named
  };
});

const mockMonaco = mockedMonacoApi as any;

describe('EditorDocumentModel Large File Mode', () => {
  let injector: MockInjector;
  let hashCalculateService: IHashCalculateService;
  const sizeProviderContentMap = new Map<string, string>();
  const sizeProvider: IEditorDocumentModelContentProvider = {
    handlesScheme: (scheme: string) => scheme === 'size',
    provideEditorDocumentModelContent: async (uri: URI) => sizeProviderContentMap.get(uri.toString()) || '',
    provideEditorDocumentModelContentSize: async (uri: URI) => {
      const content = sizeProviderContentMap.get(uri.toString());
      return content ? Buffer.byteLength(content, 'utf8') : undefined;
    },
    isReadonly: () => false,
    onDidChangeContent: new Emitter<URI>().event,
  };

  beforeEach(async () => {
    injector = createBrowserInjector([]);
    injector.addProviders({
      token: IDocPersistentCacheProvider,
      useClass: EmptyDocCacheImpl,
    });
    injector.addProviders(
      { token: IEditorDocumentModelService, useClass: EditorDocumentModelServiceImpl },
      { token: IEditorDocumentModelContentRegistry, useClass: EditorDocumentModelContentRegistryImpl },
    );
    useMockStorage(injector);
    hashCalculateService = injector.get(IHashCalculateService);
    await hashCalculateService.initialize();
    injector.get(IEditorDocumentModelContentRegistry).registerEditorDocumentModelContentProvider(sizeProvider);
    // We don't need to set global.monaco if we mocked the module, but for safety in other utils maybe?
    (global as any).monaco = mockMonaco;
  });

  afterEach(() => {
    delete (global as any).monaco;
    jest.restoreAllMocks();
    sizeProviderContentMap.clear();
  });

  it('should disable features for large files', async () => {
    const uri = new URI(`test://testUri${Math.random()}`);
    // Create content large enough (simulating large file)
    const largeFileLimit = 1024 * 1024; // 1MB
    const content = 'a'.repeat(largeFileLimit + 100);

    // Mock preference service to return specific large file limit
    const preferenceService = injector.get(PreferenceService);
    // Mock get method
    (preferenceService.get as jest.Mock) = jest.fn((key, defaultValue) => {
      if (key === 'editor.largeFile') {
        return largeFileLimit;
      }
      if (key === 'editor.largeFileOptimizations') {
        return true;
      }
      return defaultValue;
    });

    const docModel = injector.get(EditorDocumentModel, [
      uri,
      content,
      { byteSize: Buffer.byteLength(content, 'utf8') },
    ]);

    // Verifying isLargeFile property
    expect(docModel.isLargeFile).toBe(true);
  });

  it('should mark large file when provider supplies byteSize via service', async () => {
    const uri = new URI(`size://serviceLarge${Math.random()}`);
    const largeFileLimit = 2048;
    const content = 'x'.repeat(largeFileLimit + 10);
    sizeProviderContentMap.set(uri.toString(), content);

    const preferenceService = injector.get(PreferenceService);
    (preferenceService.get as jest.Mock) = jest.fn((key, defaultValue) => {
      if (key === 'editor.largeFile') {
        return largeFileLimit;
      }
      if (key === 'editor.largeFileOptimizations') {
        return true;
      }
      return defaultValue;
    });

    const docService = injector.get(IEditorDocumentModelService);
    const ref = await docService.createModelReference(uri);

    expect(ref.instance.isLargeFile).toBe(true);
    ref.dispose();
  });

  it('should detect large file size based on byte length', async () => {
    const uri = new URI(`test://testUriMultiByte${Math.random()}`);
    const largeFileLimit = 1024;
    // Each Chinese character is 3 bytes in UTF-8, so the byte length exceeds the limit while char length does not.
    const content = '汉'.repeat(Math.floor(largeFileLimit / 3) + 1);

    const preferenceService = injector.get(PreferenceService);
    (preferenceService.get as jest.Mock) = jest.fn((key, defaultValue) => {
      if (key === 'editor.largeFile') {
        return largeFileLimit;
      }
      if (key === 'editor.largeFileOptimizations') {
        return true;
      }
      return defaultValue;
    });

    const docModel = injector.get(EditorDocumentModel, [
      uri,
      content,
      { byteSize: Buffer.byteLength(content, 'utf8') },
    ]);

    expect(docModel.isLargeFile).toBe(true);
  });

  it('should NOT enable large file mode for normal files', async () => {
    const uri = new URI(`test://testUriNormal${Math.random()}`);
    const largeFileLimit = 1024 * 1024;
    const content = 'a'.repeat(largeFileLimit - 100); // Smaller than limit

    const preferenceService = injector.get(PreferenceService);
    (preferenceService.get as jest.Mock) = jest.fn((key, defaultValue) => {
      if (key === 'editor.largeFile') {
        return largeFileLimit;
      }
      return defaultValue;
    });

    const docModel = injector.get(EditorDocumentModel, [
      uri,
      content,
      { byteSize: Buffer.byteLength(content, 'utf8') },
    ]);

    expect(docModel.isLargeFile).toBe(false);
  });

  it('should NOT enable large file mode if optimizations are disabled', async () => {
    const uri = new URI(`test://testUriNoOpt${Math.random()}`);
    const largeFileLimit = 1024 * 1024;
    const content = 'a'.repeat(largeFileLimit + 100);

    const preferenceService = injector.get(PreferenceService);
    (preferenceService.get as jest.Mock) = jest.fn((key, defaultValue) => {
      if (key === 'editor.largeFile') {
        return largeFileLimit;
      }
      if (key === 'editor.largeFileOptimizations') {
        return false;
      }
      return defaultValue;
    });

    const docModel = injector.get(EditorDocumentModel, [uri, content, { byteSize: content.length }]);

    expect(docModel.isLargeFile).toBe(false);
  });
});
