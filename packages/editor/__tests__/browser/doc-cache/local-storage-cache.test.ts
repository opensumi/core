import { uniqueId } from 'lodash';
import { promisify } from 'util';
import { ILoggerManagerClient, URI } from '@opensumi/ide-core-browser';
import { LocalStorageDocCacheImpl } from '@opensumi/ide-editor/lib/browser/doc-cache';
import { IHashCalculateService } from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';
import { IWorkspaceStorageService } from '@opensumi/ide-workspace';

import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { IDocPersistentCacheProvider } from '../../../src/common';
import { EditorDocumentModel } from '../../../src/browser/doc-model/main';

describe('LocalStorageDocCacheImpl', () => {
  let content: string;
  let injector: MockInjector;
  let hashCalculateService: IHashCalculateService;

  beforeEach(async (done) => {
    injector = createBrowserInjector([]);
    injector.addProviders(
      {
        token: IDocPersistentCacheProvider,
        useClass: LocalStorageDocCacheImpl,
      },
      {
        token: ILoggerManagerClient,
        useValue: {
          getLogger: () => {
            return {
              log: () => {},
              debug: () => {},
              error: () => {},
              verbose: () => {},
              warn: () => {},
            };
          },
        },
      },
      {
        token: IWorkspaceStorageService,
        useValue: {
          getData() { },
          setData() { },
        },
      },
    );
    hashCalculateService = injector.get(IHashCalculateService);
    await hashCalculateService.initialize();
    content = uniqueId('content');
    done();
  });

  it('get undefined from storageService', async () => {
    const uri = new URI('test://testUri1');
    const storageService: IWorkspaceStorageService = injector.get(IWorkspaceStorageService);
    jest.spyOn(storageService, 'getData').mockResolvedValue(undefined as never);

    const docModel = injector.get(EditorDocumentModel, [uri, content, { savable: true }]);
    expect(docModel.dirty).toBeFalsy();

    await promisify(setTimeout)(100);
    expect(docModel.dirty).toBeFalsy();
  });

  it('get ChangeCache from storageService', async () => {
    const storageService: IWorkspaceStorageService = injector.get(IWorkspaceStorageService);
    const uri = new URI('test://testUri2');
    jest.spyOn(storageService, 'getData').mockResolvedValue({
      path: uri.path.toString(),
      startMD5: hashCalculateService.calculate(content),
      changeMatrix: [
        [
          ['a', 0, 0, 1, 0],
        ],
      ],
    } as never);

    const docModel = injector.get(EditorDocumentModel, [uri, content, { savable: true }]);
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
    const docModel = injector.get(EditorDocumentModel, [uri, content, { savable: true }]);
    const newContent = uniqueId('content');
    docModel.getMonacoModel().setValue(newContent);

    expect(setDataSpy).toBeCalledTimes(1);
    expect(setDataSpy).toBeCalledWith(`LocalStorageDocCacheImpl_${uri.toString()}`, {
      path: '',
      startMD5: hashCalculateService.calculate(content),
      changeMatrix: [
        [
          [newContent, 1, 1, 1, 9],
        ],
      ],
    });
  });

  it('call persistCache when content change not dirty', () => {
    const storageService: IWorkspaceStorageService = injector.get(IWorkspaceStorageService);
    const setDataSpy = jest.spyOn(storageService, 'setData');
    const uri = new URI('test://testUri4');
    const docModel = injector.get(EditorDocumentModel, [uri, content]);
    const newContent = uniqueId('content');
    docModel.getMonacoModel().setValue(newContent);

    expect(setDataSpy).toBeCalledTimes(1);
    expect(setDataSpy).toBeCalledWith(`LocalStorageDocCacheImpl_${uri.toString()}`, undefined);
  });
});
