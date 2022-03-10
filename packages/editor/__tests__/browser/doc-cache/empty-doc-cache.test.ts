import { uniqueId } from 'lodash';

import { URI } from '@opensumi/ide-core-browser';
import { IHashCalculateService } from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';
import { EmptyDocCacheImpl } from '@opensumi/ide-editor/lib/browser/doc-cache';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { EditorDocumentModel } from '../../../src/browser/doc-model/main';
import { IDocPersistentCacheProvider } from '../../../src/common';


describe('EmptyDocCacheImpl', () => {
  let injector: MockInjector;
  let uri: URI;
  let content: string;
  let hashCalculateService: IHashCalculateService;

  beforeEach(async (done) => {
    injector = createBrowserInjector([]);
    injector.addProviders({
      token: IDocPersistentCacheProvider,
      useClass: EmptyDocCacheImpl,
    });

    uri = new URI(`test://testUri${Math.random()}`);
    content = uniqueId('content');
    hashCalculateService = injector.get(IHashCalculateService);
    await hashCalculateService.initialize();
    done();
  });

  it('call hasCache during DocumentModel constructing', () => {
    const cacheProvider: IDocPersistentCacheProvider = injector.get(IDocPersistentCacheProvider);

    const hasCacheSpy = jest.spyOn(cacheProvider, 'hasCache');
    const getCacheSpy = jest.spyOn(cacheProvider, 'getCache');

    injector.get(EditorDocumentModel, [uri, content]);
    expect(hasCacheSpy).toBeCalledTimes(1);
    expect(getCacheSpy).toBeCalledTimes(0);
  });

  it('call getCache during DocumentModel constructing', () => {
    const cacheProvider: IDocPersistentCacheProvider = injector.get(IDocPersistentCacheProvider);

    const hasCacheSpy = jest.spyOn(cacheProvider, 'hasCache').mockReturnValue(true);
    const getCacheSpy = jest.spyOn(cacheProvider, 'getCache');

    injector.get(EditorDocumentModel, [uri, content]);
    expect(hasCacheSpy).toBeCalledTimes(1);
    expect(getCacheSpy).toBeCalledTimes(1);
    expect(getCacheSpy).toBeCalledWith(uri, 'utf8');
  });

  it('call persistCache when content change', () => {
    const cacheProvider: IDocPersistentCacheProvider = injector.get(IDocPersistentCacheProvider);
    const persistCacheSpy = jest.spyOn(cacheProvider, 'persistCache');

    const docModel = injector.get(EditorDocumentModel, [uri, content, { savable: true }]);
    const newContent = uniqueId('content');
    docModel.getMonacoModel().setValue(newContent);

    expect(persistCacheSpy).toBeCalledTimes(1);
    expect(persistCacheSpy).toBeCalledWith(uri, {
      changeMatrix: [
        [
          {
            range: {
              endColumn: 9,
              endLineNumber: 1,
              startColumn: 1,
              startLineNumber: 1,
            },
            rangeLength: 8,
            rangeOffset: 0,
            text: newContent,
          },
        ],
      ],
      content: newContent,
      dirty: true,
      encoding: 'utf8',
      startMD5: hashCalculateService.calculate(content),
    });
  });
});
