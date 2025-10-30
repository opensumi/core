import uniqueId from 'lodash/uniqueId';

import { IEventBus, SaveTaskResponseState, URI } from '@opensumi/ide-core-browser';
import { IHashCalculateService } from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';
import { EmptyDocCacheImpl } from '@opensumi/ide-editor/lib/browser/doc-cache';
import { monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { EOL } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { IMessageService } from '@opensumi/ide-overlay';
import { isLinux, isMacintosh } from '@opensumi/monaco-editor-core/esm/vs/base/common/platform';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { createMockedMonaco } from '../../../../monaco/__mocks__/monaco';
import { EditorDocumentModel, EditorDocumentModelConstructionOptions } from '../../../src/browser/doc-model/main';
import {
  EditorDocumentModelContentChangedEvent,
  EditorDocumentModelOptionChangedEvent,
  EditorDocumentModelSaveErrorEvent,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelService,
} from '../../../src/browser/doc-model/types';
import { IDocPersistentCacheProvider, SaveReason } from '../../../src/common';

describe('EditorDocumentModel', () => {
  let injector: MockInjector;
  let hashCalculateService: IHashCalculateService;

  beforeEach(async () => {
    injector = createBrowserInjector([]);
    injector.addProviders({
      token: IDocPersistentCacheProvider,
      useClass: EmptyDocCacheImpl,
    });
    hashCalculateService = injector.get(IHashCalculateService);
    await hashCalculateService.initialize();
    (global as any).monaco = createMockedMonaco() as any;
  });

  afterEach(() => {
    delete (global as any).monaco;
  });

  describe('construcotr', () => {
    let uri: URI;
    let content: string;
    let eventBus: IEventBus;
    let optionChangeFn: jest.Mock;
    let chagneFn: jest.Mock;

    beforeEach(() => {
      uri = new URI(`test://testUri${Math.random()}`);
      content = uniqueId('content');
      eventBus = injector.get(IEventBus);

      optionChangeFn = jest.fn();
      eventBus.on(EditorDocumentModelOptionChangedEvent, optionChangeFn);

      chagneFn = jest.fn();
      eventBus.on(EditorDocumentModelContentChangedEvent, chagneFn);
    });

    it('create EditorDocumentModel normally', () => {
      const docModel = injector.get(EditorDocumentModel, [uri, content]);
      expect(docModel.baseContent).toBe(content);
      expect(docModel.dirty).toBeFalsy();
      expect(docModel.encoding).toBe('utf8');
      expect(docModel.readonly).toBe(false);
      expect(docModel.savable).toBe(false);
      /**
       * 这里 VS Code 获取默认 EOL 的逻辑是根据 platform 来判断的
       * platform 的逻辑是如果有 navigator 对象，则看 UA 是否有 Macintosh、Linux、Windows 等字符
       * 但单测 JSDOM 环境下 UA 是 Mozilla/5.0 ([darwin/linux/windows]) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/15.2.1
       * 会导致 isWindow/isLinux/isMacintosh 全部为 false
       * 因为只会在单测的情况下出现判断错误，所以这里沿用 VS Code 的 platform 判断逻辑，保证表现一致
       */
      expect(docModel.eol).toBe(isMacintosh || isLinux ? EOL.LF : EOL.CRLF);
      // Monaco 20 开始，没有指定 languageId 会 fallback 到 plaintext
      expect(docModel.languageId).toBe('plaintext');

      expect(optionChangeFn).toHaveBeenCalledTimes(0);
      expect(chagneFn).toHaveBeenCalledTimes(0);
    });

    it('create EditorDocumentModel with Options', () => {
      const languageId = uniqueId('languageId');
      // Monaco 20 开始，不能创建没有注册过语言的 textModel
      monacoApi.languages.register({
        id: languageId,
        aliases: ['Test languageId'],
        extensions: ['.test'],
      });
      const opts: EditorDocumentModelConstructionOptions = {
        eol: EOL.LF,
        encoding: uniqueId('encoding'),
        languageId,
        readonly: true,
        savable: true,
      };
      const docModel = injector.get(EditorDocumentModel, [uri, content, opts]);
      expect(docModel.baseContent).toBe(content);
      expect(docModel.dirty).toBeFalsy();
      expect(docModel.encoding).toBe(opts.encoding);
      expect(docModel.readonly).toBe(opts.readonly);
      expect(docModel.savable).toBe(opts.savable);
      expect(docModel.eol).toBe(opts.eol);
      expect(docModel.languageId).toBe(opts.languageId);

      expect(optionChangeFn).toHaveBeenCalledTimes(0);
      expect(chagneFn).toHaveBeenCalledTimes(0);
    });

    it('create EditorDocumentModel with synchronous cache', () => {
      const cacheProvider = injector.get(IDocPersistentCacheProvider);
      jest.spyOn(cacheProvider, 'hasCache').mockReturnValue(true);
      jest.spyOn(cacheProvider, 'getCache').mockReturnValue(null);

      const docModel = injector.get(EditorDocumentModel, [uri, content, { savable: true }]);
      expect(docModel.baseContent).toBe(content);
      expect(docModel.dirty).toBeFalsy();

      expect(chagneFn).toHaveBeenCalledTimes(0);
    });

    it('create EditorDocumentModel with synchronous content cache', () => {
      const cacheProvider = injector.get(IDocPersistentCacheProvider);
      const newContent = uniqueId('content');

      jest.spyOn(cacheProvider, 'hasCache').mockReturnValue(true);
      jest.spyOn(cacheProvider, 'getCache').mockReturnValue({
        path: uri.path.toString(),
        startMD5: hashCalculateService.calculate(content),
        content: newContent,
      });

      const docModel = injector.get(EditorDocumentModel, [uri, content, { savable: true }]);
      expect(docModel.baseContent).toBe(content);
      expect(docModel.getMonacoModel().getValue()).toBe(newContent);
      expect(docModel.dirty).toBeTruthy();

      expect(chagneFn).toHaveBeenCalledTimes(1);
    });

    it('create EditorDocumentModel with synchronous change cache', () => {
      const cacheProvider = injector.get(IDocPersistentCacheProvider);

      jest.spyOn(cacheProvider, 'hasCache').mockReturnValue(true);
      jest.spyOn(cacheProvider, 'getCache').mockReturnValue({
        path: uri.path.toString(),
        startMD5: hashCalculateService.calculate(content),
        changeMatrix: [[['a', 0, 0, 1, 0]]],
      });

      const docModel = injector.get(EditorDocumentModel, [uri, content, { savable: true }]);
      expect(docModel.baseContent).toBe(content);
      expect(docModel.getMonacoModel().getValue()).toBe('a' + content);
      expect(docModel.dirty).toBeTruthy();

      expect(chagneFn).toHaveBeenCalledTimes(1);
    });

    it('create EditorDocumentModel with async change cache', async () => {
      const cacheProvider = injector.get(IDocPersistentCacheProvider);

      jest.spyOn(cacheProvider, 'hasCache').mockReturnValue(true);
      jest.spyOn(cacheProvider, 'getCache').mockResolvedValue({
        path: uri.path.toString(),
        startMD5: hashCalculateService.calculate(content),
        changeMatrix: [[['a', 0, 0, 1, 0]]],
      });

      const docModel = injector.get(EditorDocumentModel, [uri, content, { savable: true }]);
      expect(docModel.getMonacoModel().getValue()).toBe(content);
      expect(docModel.dirty).toBeFalsy();
      expect(chagneFn).toHaveBeenCalledTimes(0);

      await Promise.resolve();

      expect(docModel.getMonacoModel().getValue()).toBe('a' + content);
      expect(chagneFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispose', () => {
    let uri: URI;
    let content: string;

    beforeEach(() => {
      uri = new URI(`test://dispose/${Math.random()}`);
      content = uniqueId('dispose-content');
    });

    it('should release internal resources on dispose', () => {
      const docModel = injector.get(EditorDocumentModel, [uri, content, { savable: true }]);
      const autoSave = docModel.tryAutoSaveAfterDelay;
      const cancelSpy = jest.spyOn(autoSave, 'cancel');

      const docModelAny = docModel as any;
      docModelAny.savingTasks = [{ dispose: jest.fn() }, { dispose: jest.fn() }];
      docModelAny.dirtyChanges = [{ fromVersionId: 1, toVersionId: 2, changes: [] }];
      const tasksSnapshot = [...docModelAny.savingTasks];

      // Prime MD5 cache to ensure it gets cleared.
      docModel.getBaseContentMd5();

      docModel.dispose();

      expect(cancelSpy).toHaveBeenCalled();
      tasksSnapshot.forEach((task) => expect(task.dispose).toHaveBeenCalled());
      expect(docModelAny.savingTasks).toHaveLength(0);
      expect(docModelAny.dirtyChanges).toHaveLength(0);
      expect(docModel.baseContent).toBe('');
      expect(docModelAny._baseContentMd5).toBeNull();
      expect(docModelAny._tryAutoSaveAfterDelay).toBeUndefined();
    });
  });

  describe('save', () => {
    let uri: URI;
    let docModel: EditorDocumentModel;
    let saveEditorDocumentModel: jest.Mock;
    let eventBus: IEventBus;
    let saveErrorListener: jest.Mock;
    let saveErrorDisposer: { dispose(): void };

    beforeEach(() => {
      uri = new URI(`test://save/${Math.random()}`);
      eventBus = injector.get(IEventBus);
      injector.mockService(IEditorDocumentModelContentRegistry, {
        getProvider: jest.fn().mockResolvedValue({
          isReadonly: jest.fn().mockResolvedValue(false),
        }),
      });
      injector.mockService(IMessageService, {
        error: jest.fn(),
      });
      saveEditorDocumentModel = jest.fn().mockResolvedValue({
        state: SaveTaskResponseState.ERROR,
        errorMessage: 'save failed',
      });
      injector.mockService(IEditorDocumentModelService, {
        saveEditorDocumentModel,
      });
      docModel = injector.get(EditorDocumentModel, [uri, 'original content', { savable: true }]);
      saveErrorListener = jest.fn();
      saveErrorDisposer = eventBus.on(EditorDocumentModelSaveErrorEvent, saveErrorListener);
    });

    afterEach(() => {
      saveErrorDisposer.dispose();
      docModel.dispose();
    });

    it('should emit save error event when saving fails', async () => {
      docModel.getMonacoModel().setValue('updated content');

      const result = await docModel.save(false, SaveReason.AfterDelay);

      expect(result).toBe(false);
      expect(saveEditorDocumentModel).toHaveBeenCalledTimes(1);
      expect(saveErrorListener).toHaveBeenCalledTimes(1);
      const event = saveErrorListener.mock.calls[0][0];
      expect(event.payload.uri.toString()).toBe(uri.toString());
      expect(event.payload.errorMessage).toBe('save failed');
    });
  });
});
