import * as md5 from 'md5';
import { uniqueId } from 'lodash';
import { URI } from '@ali/ide-core-browser';

import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import {  IDocPersistentCacheProvider } from '../../../lib/common';
import { EditorDocumentModel } from '../../../lib/browser/doc-model/main';
import { createMockedMonaco } from '@ali/ide-monaco/lib/__mocks__/monaco';
import { EmptyDocCacheImpl } from '@ali/ide-editor/lib/browser/doc-cache';

describe('EmptyDocCacheImpl', () => {
  let injector: MockInjector;
  let uri: URI;
  let content: string;

  beforeEach(() => {
    injector = createBrowserInjector([]);
    injector.addProviders(
      {
        token: IDocPersistentCacheProvider,
        useClass: EmptyDocCacheImpl,
      },
    );
    (global as any).monaco = createMockedMonaco() as any;

    uri = new URI('test://testUri1');
    content = uniqueId('content');
  });

  afterEach(() => {
    delete (global as any).monaco;
  });

  it('call hasCache during DocumentModel constructing', () => {
    const cacheProvider: IDocPersistentCacheProvider = injector.get(IDocPersistentCacheProvider);

    const hasCacheSpy = jest.spyOn(cacheProvider, 'hasCache');
    const getCacheSpy = jest.spyOn(cacheProvider, 'getCache');

    injector.get(EditorDocumentModel, [ uri, content ]);
    expect(hasCacheSpy).toBeCalledTimes(1);
    expect(getCacheSpy).toBeCalledTimes(0);
  });

  it('call getCache during DocumentModel constructing', () => {
    const cacheProvider: IDocPersistentCacheProvider = injector.get(IDocPersistentCacheProvider);

    const hasCacheSpy = jest.spyOn(cacheProvider, 'hasCache').mockReturnValue(true);
    const getCacheSpy = jest.spyOn(cacheProvider, 'getCache');

    injector.get(EditorDocumentModel, [ uri, content ]);
    expect(hasCacheSpy).toBeCalledTimes(1);
    expect(getCacheSpy).toBeCalledTimes(1);
    expect(getCacheSpy).toBeCalledWith(uri, 'utf8');
  });

  it('call persistCache when content change', () => {
    const cacheProvider: IDocPersistentCacheProvider = injector.get(IDocPersistentCacheProvider);
    const persistCacheSpy = jest.spyOn(cacheProvider, 'persistCache');

    const docModel = injector.get(EditorDocumentModel, [ uri, content, { savable: true } ]);
    const newContent = uniqueId('content');
    docModel.getMonacoModel().setValue(newContent);

    expect(persistCacheSpy).toBeCalledTimes(1);
    expect(persistCacheSpy).toBeCalledWith(uri, {
      changeMatrix: [
        [{
          range: {
            endColumn: 8,
            endLineNumber: 0,
            startColumn: 8,
            startLineNumber: 0,
          },
          rangeLength: 0,
          rangeOffset: 8,
          text: '',
        }],
      ],
      content: newContent,
      dirty: true,
      encoding: 'utf8',
      startMD5: md5(content),
    });
  });
});
