import * as md5 from 'md5';
import { uniqueId } from 'lodash';
import { promisify } from 'util';
import { URI } from '@ali/ide-core-browser';
import { LocalStorageDocCacheImpl } from '@ali/ide-editor/lib/browser/doc-cache';
import { IWorkspaceStorageService } from '@ali/ide-workspace';

import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { IDocPersistentCacheProvider } from '../../../src/common';
import { EditorDocumentModel } from '../../../src/browser/doc-model/main';

describe('LocalStorageDocCacheImpl', () => {
  let injector: MockInjector;
  let content: string;

  beforeEach(() => {
    injector = createBrowserInjector([]);
    injector.addProviders(
      {
        token: IDocPersistentCacheProvider,
        useClass: LocalStorageDocCacheImpl,
      },
      {
        token: IWorkspaceStorageService,
        useValue: {
          getData() {},
          setData() {},
        },
      },
    );

    content = uniqueId('content');
  });

  it('get undefined from storageService', async () => {
    const uri = new URI('test://testUri1');
    const storageService: IWorkspaceStorageService = injector.get(IWorkspaceStorageService);
    jest.spyOn(storageService, 'getData').mockResolvedValue(undefined as never);

    const docModel = injector.get(EditorDocumentModel, [ uri, content, { savable: true }]);
    expect(docModel.dirty).toBeFalsy();

    await promisify(setTimeout)(100);
    expect(docModel.dirty).toBeFalsy();
  });

  it('get ChangeCache from storageService', async () => {
    const storageService: IWorkspaceStorageService = injector.get(IWorkspaceStorageService);
    const uri = new URI('test://testUri2');
    jest.spyOn(storageService, 'getData').mockResolvedValue({
      path: uri.path.toString(),
      startMD5: md5(content),
      changeMatrix: [
        [
          ['a', 0, 0, 1, 0],
        ],
      ],
    } as never);

    const docModel = injector.get(EditorDocumentModel, [ uri, content, { savable: true }]);
    expect(docModel.getMonacoModel().getValue()).toBe(content);
    expect(docModel.dirty).toBeFalsy();

    await promisify(setTimeout)(100);
    expect(docModel.dirty).toBeTruthy();
    expect(docModel.getMonacoModel().getValue()).toBe('a' + content);
  });

  it('call persistCache when content change', () => {
    const storageService: IWorkspaceStorageService = injector.get(IWorkspaceStorageService);
    const setDataSpy = jest.spyOn(storageService, 'setData');
    const uri = new URI('test://testUri30');
    const docModel = injector.get(EditorDocumentModel, [ uri, content, { savable: true } ]);
    const newContent = uniqueId('content');
    docModel.getMonacoModel().setValue(newContent);

    expect(setDataSpy).toBeCalledTimes(1);
    expect(setDataSpy).toBeCalledWith(`LocalStorageDocCacheImpl_${uri.toString()}`, {
      path: '',
      startMD5: md5(content),
      changeMatrix: [
        [
          [ newContent, 1, 1, 1 , 9],
        ],
      ],
    });
  });

  it('call persistCache when content change not dirty', () => {
    const storageService: IWorkspaceStorageService = injector.get(IWorkspaceStorageService);
    const setDataSpy = jest.spyOn(storageService, 'setData');
    const uri = new URI('test://testUri4');
    const docModel = injector.get(EditorDocumentModel, [ uri, content ]);
    const newContent = uniqueId('content');
    docModel.getMonacoModel().setValue(newContent);

    expect(setDataSpy).toBeCalledTimes(1);
    expect(setDataSpy).toBeCalledWith(`LocalStorageDocCacheImpl_${uri.toString()}`, undefined);
  });
});
