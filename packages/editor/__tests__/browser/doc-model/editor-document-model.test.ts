import { uniqueId } from 'lodash';

import { URI, IEventBus } from '@opensumi/ide-core-browser';
import { IHashCalculateService } from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';
import { EmptyDocCacheImpl } from '@opensumi/ide-editor/lib/browser/doc-cache';
import { EOL } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { isMacintosh, isLinux } from '@opensumi/monaco-editor-core/esm/vs/base/common/platform';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';


import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { createMockedMonaco } from '../../../../monaco/__mocks__/monaco';
import { EditorDocumentModel, EditorDocumentModelConstructionOptions } from '../../../src/browser/doc-model/main';
import {
  EditorDocumentModelOptionChangedEvent,
  EditorDocumentModelContentChangedEvent,
} from '../../../src/browser/doc-model/types';
import { IDocPersistentCacheProvider } from '../../../src/common';


describe('EditorDocumentModel', () => {
  let injector: MockInjector;
  let hashCalculateService: IHashCalculateService;

  beforeEach(async (done) => {
    injector = createBrowserInjector([]);
    injector.addProviders({
      token: IDocPersistentCacheProvider,
      useClass: EmptyDocCacheImpl,
    });
    hashCalculateService = injector.get(IHashCalculateService);
    await hashCalculateService.initialize();
    (global as any).monaco = createMockedMonaco() as any;
    done();
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

      expect(optionChangeFn).toBeCalledTimes(0);
      expect(chagneFn).toBeCalledTimes(0);
    });

    it('create EditorDocumentModel with Options', () => {
      const languageId = uniqueId('languageId');
      // Monaco 20 开始，不能创建没有注册过语言的 textModel
      monaco.languages.register({
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

      expect(optionChangeFn).toBeCalledTimes(0);
      expect(chagneFn).toBeCalledTimes(0);
    });

    it('create EditorDocumentModel with synchronous cache', () => {
      const cacheProvider = injector.get(IDocPersistentCacheProvider);
      jest.spyOn(cacheProvider, 'hasCache').mockReturnValue(true);
      jest.spyOn(cacheProvider, 'getCache').mockReturnValue(null);

      const docModel = injector.get(EditorDocumentModel, [uri, content, { savable: true }]);
      expect(docModel.baseContent).toBe(content);
      expect(docModel.dirty).toBeFalsy();

      expect(chagneFn).toBeCalledTimes(0);
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

      expect(chagneFn).toBeCalledTimes(1);
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

      expect(chagneFn).toBeCalledTimes(1);
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
      expect(chagneFn).toBeCalledTimes(0);

      await Promise.resolve();

      expect(docModel.getMonacoModel().getValue()).toBe('a' + content);
      expect(chagneFn).toBeCalledTimes(1);
    });
  });
});
