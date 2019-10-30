import * as md5 from 'md5';
import { uniqueId } from 'lodash';
import { URI, IEventBus } from '@ali/ide-core-browser';

import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { EOL, IDocPersistentCacheProvider } from '../../../lib/common';
import { EditorDocumentModel, EditorDocumentModelConstructionOptions } from '../../../lib/browser/doc-model/main';
import { EditorDocumentModelCreationEvent, EditorDocumentModelOptionChangedEvent, EditorDocumentModelContentChangedEvent } from '../../../lib/browser/doc-model/types';
import { createMockedMonaco } from '@ali/ide-monaco/lib/__mocks__/monaco';
import { EmptyDocCacheImpl } from '@ali/ide-editor/lib/browser/doc-cache';

describe('EditorDocumentModel', () => {
  let injector: MockInjector;

  beforeEach(() => {
    injector = createBrowserInjector([]);
    injector.addProviders(
      {
        token: IDocPersistentCacheProvider,
        useClass: EmptyDocCacheImpl,
      },
    );
    (global as any).monaco = createMockedMonaco() as any;
  });

  afterEach(() => {
    delete (global as any).monaco;
  });

  describe('construcotr', () => {
    let uri: URI;
    let content: string;
    let eventBus: IEventBus;
    let creationFn: jest.Mock;
    let optionChangeFn: jest.Mock;
    let chagneFn: jest.Mock;

    beforeEach(() => {
      uri = new URI('test://testUri1');
      content = uniqueId('content');
      eventBus = injector.get(IEventBus);

      creationFn = jest.fn();
      eventBus.on(EditorDocumentModelCreationEvent, creationFn);

      optionChangeFn = jest.fn();
      eventBus.on(EditorDocumentModelOptionChangedEvent, optionChangeFn);

      chagneFn = jest.fn();
      eventBus.on(EditorDocumentModelContentChangedEvent, chagneFn);
    });

    it('create EditorDocumentModel normally', () => {
      const docModel = injector.get(EditorDocumentModel, [ uri, content ]);
      expect(docModel.baseContent).toBe(content);
      expect(docModel.dirty).toBeFalsy();
      expect(docModel.encoding).toBe('utf8');
      expect(docModel.readonly).toBe(false);
      expect(docModel.savable).toBe(false);
      expect(docModel.eol).toBe(EOL.LF);
      expect(docModel.languageId).toBeUndefined();

      expect(creationFn).toBeCalledTimes(1);
      expect(optionChangeFn).toBeCalledTimes(0);
      expect(chagneFn).toBeCalledTimes(0);
    });

    it('create EditorDocumentModel with Options', () => {
      const opts: EditorDocumentModelConstructionOptions = {
        eol: EOL.LF,
        encoding: uniqueId('encoding'),
        languageId: uniqueId('languageId'),
        readonly: true,
        savable: true,
      };
      const docModel = injector.get(EditorDocumentModel, [ uri, content, opts]);
      expect(docModel.baseContent).toBe(content);
      expect(docModel.dirty).toBeFalsy();
      expect(docModel.encoding).toBe(opts.encoding);
      expect(docModel.readonly).toBe(opts.readonly);
      expect(docModel.savable).toBe(opts.savable);
      expect(docModel.eol).toBe(opts.eol);
      expect(docModel.languageId).toBe(opts.languageId);

      expect(creationFn).toBeCalledTimes(1);
      expect(optionChangeFn).toBeCalledTimes(0);
      expect(chagneFn).toBeCalledTimes(0);
    });

    it('create EditorDocumentModel with synchronous cache', () => {
      const cacheProvider = injector.get(IDocPersistentCacheProvider);
      jest.spyOn(cacheProvider, 'hasCache').mockReturnValue(true);
      jest.spyOn(cacheProvider, 'getCache').mockReturnValue(null);

      const docModel = injector.get(EditorDocumentModel, [ uri, content, { savable: true }]);
      expect(docModel.baseContent).toBe(content);
      expect(docModel.dirty).toBeFalsy();

      expect(creationFn).toBeCalledTimes(1);
      expect(chagneFn).toBeCalledTimes(0);
    });

    it('create EditorDocumentModel with synchronous content cache', () => {
      const cacheProvider = injector.get(IDocPersistentCacheProvider);
      const newContent = uniqueId('content');

      jest.spyOn(cacheProvider, 'hasCache').mockReturnValue(true);
      jest.spyOn(cacheProvider, 'getCache').mockReturnValue({
        path: uri.path.toString(),
        startMD5: md5(content),
        content: newContent,
      });

      const docModel = injector.get(EditorDocumentModel, [ uri, content, { savable: true }]);
      expect(docModel.baseContent).toBe(content);
      expect(docModel.getMonacoModel().getValue()).toBe(newContent);
      expect(docModel.dirty).toBeTruthy();

      expect(creationFn).toBeCalledTimes(1);
      expect(chagneFn).toBeCalledTimes(1);
    });

    it('create EditorDocumentModel with synchronous change cache', () => {
      const cacheProvider = injector.get(IDocPersistentCacheProvider);

      jest.spyOn(cacheProvider, 'hasCache').mockReturnValue(true);
      jest.spyOn(cacheProvider, 'getCache').mockReturnValue({
        path: uri.path.toString(),
        startMD5: md5(content),
        changeMatrix: [
          [
            ['a', 0, 0, 1, 0],
          ],
        ],
      });

      const docModel = injector.get(EditorDocumentModel, [ uri, content, { savable: true }]);
      expect(docModel.baseContent).toBe(content);
      expect(docModel.getMonacoModel().getValue()).toBe('a' + content);
      expect(docModel.dirty).toBeTruthy();

      expect(creationFn).toBeCalledTimes(1);
      expect(chagneFn).toBeCalledTimes(1);
    });

    it('create EditorDocumentModel with async change cache', async () => {
      const cacheProvider = injector.get(IDocPersistentCacheProvider);

      jest.spyOn(cacheProvider, 'hasCache').mockReturnValue(true);
      jest.spyOn(cacheProvider, 'getCache').mockResolvedValue({
        path: uri.path.toString(),
        startMD5: md5(content),
        changeMatrix: [
          [
            ['a', 0, 0, 1, 0],
          ],
        ],
      });

      const docModel = injector.get(EditorDocumentModel, [ uri, content, { savable: true }]);
      expect(docModel.getMonacoModel().getValue()).toBe(content);
      expect(docModel.dirty).toBeFalsy();
      expect(creationFn).toBeCalledTimes(1);
      expect(chagneFn).toBeCalledTimes(0);

      await Promise.resolve();

      expect(docModel.getMonacoModel().getValue()).toBe('a' + content);
      expect(chagneFn).toBeCalledTimes(1);
    });
  });
});
