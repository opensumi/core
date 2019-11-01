import * as md5 from 'md5';
import { URI, Disposable, isUndefinedOrNull, IEventBus, ILogger, IRange, IEditorDocumentEditChange, isThenable, localize, formatLocalize, PreferenceService } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';

import { EOL, EndOfLineSequence, IDocPersistentCacheProvider, IDocCache, isDocContentCache, parseRangeFrom } from '../../common';
import { IEditorDocumentModel, IEditorDocumentModelContentRegistry, IEditorDocumentModelService, EditorDocumentModelCreationEvent, EditorDocumentModelContentChangedEvent, EditorDocumentModelOptionChangedEvent, IEditorDocumentModelContentChange, EditorDocumentModelSavedEvent, ORIGINAL_DOC_SCHEME } from './types';
import { IEditorDocumentModelServiceImpl, SaveTask } from './save-task';
import { EditorDocumentError } from './editor-document-error';
import { IMessageService } from '@ali/ide-overlay';
import { ICompareService, CompareResult } from '../types';

export interface EditorDocumentModelConstructionOptions {
  eol?: EOL;
  encoding?: string;
  languageId?: string;
  readonly?: boolean;
  savable?: boolean;
}

export interface IDirtyChange {
  fromVersionId: number;
  toVersionId: number;
  changes: IEditorDocumentModelContentChange[];
}

@Injectable({multiple: true})
export class EditorDocumentModel extends Disposable implements IEditorDocumentModel {

  @Autowired(IEditorDocumentModelContentRegistry)
  contentRegistry: IEditorDocumentModelContentRegistry;

  @Autowired(IEditorDocumentModelService)
  service: IEditorDocumentModelServiceImpl;

  @Autowired(ICompareService)
  compareService: ICompareService;

  @Autowired(IDocPersistentCacheProvider)
  cacheProvider: IDocPersistentCacheProvider;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(IMessageService)
  messageService: IMessageService;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(ILogger)
  logger: ILogger;

  private monacoModel: monaco.editor.ITextModel;

  public _encoding: string = 'utf8';

  public readonly readonly: boolean = false;

  public readonly savable: boolean = false;

  private _originalEncoding: string = this._encoding;

  private _persistVersionId: number = 0;

  private _baseContent: string = '';

  private _baseContentMd5: string | null;

  private savingTasks: SaveTask[] = [];

  private dirtyChanges: IDirtyChange[] = [];

  private _previousVersionId: number;

  constructor(public readonly uri: URI, content: string, options: EditorDocumentModelConstructionOptions = {}) {
    super();
    if (options.encoding) {
      this._encoding = options.encoding;
    }
    this.readonly = !!options.readonly;
    this.savable = !!options.savable;

    this.monacoModel = monaco.editor.createModel(content, options.languageId, monaco.Uri.parse(uri.toString()));
    if (options.eol) {
      this.eol = options.eol;
    }
    this._originalEncoding = this._encoding;
    this.eventBus.fire(new EditorDocumentModelCreationEvent({
      uri: this.uri,
      languageId: this.languageId,
      eol: this.eol,
      encoding: this.encoding,
      content,
      readonly: this.readonly,
      versionId: this.monacoModel.getVersionId(),
    }));
    this._previousVersionId = this.monacoModel.getVersionId(),
    this._persistVersionId = this.monacoModel.getAlternativeVersionId();
    this.baseContent = content;

    this.listenTo(this.monacoModel);
    this.readCacheToApply();
  }

  private listenTo(monacoModel: monaco.editor.ITextModel) {
    monacoModel.onDidChangeContent((e) => {
      if (e.changes && e.changes.length > 0) {
        this.dirtyChanges.push({
          fromVersionId: this._previousVersionId,
          toVersionId: e.versionId,
          changes: e.changes,
        });
      }
      this._previousVersionId = e.versionId;
      this.notifyChangeEvent();
    });

    this.addDispose(monacoModel);
  }

  private readCacheToApply() {
    if (!this.cacheProvider.hasCache(this.uri)) {
      return;
    }

    const maybePromiseCache = this.cacheProvider.getCache(this.uri, this.encoding);
    if (maybePromiseCache) {
      if (isThenable(maybePromiseCache)) {
        maybePromiseCache
          .then((cache) => {
            if (cache) {
              this.applyCache(cache);
            }
          })
          .catch((err) => {
            this.logger.error(`${EditorDocumentError.READ_CACHE_ERROR} ${err && err.message}`);
          });
      } else {
        this.applyCache(maybePromiseCache as IDocCache);
      }
    }
  }

  private applyCache(cache: IDocCache) {
    if (this.dirty) {
      // TODO: 此时应该弹出 DiffView 让用户选择
      this.logger.error(EditorDocumentError.APPLY_CACHE_TO_DIRTY_DOCUMENT);
      return;
    }

    if (this.baseContentMd5 !== cache.startMD5) {
      // TODO: 此时应该弹出 DiffView 让用户选择
      this.logger.error(EditorDocumentError.APPLY_CACHE_TO_DIFFERENT_DOCUMENT);
      return;
    }

    if (isDocContentCache(cache)) {
      this.monacoModel.setValue(cache.content);
    } else {
      for (const changes of cache.changeMatrix) {
        const operations = changes.map((change) => ({
          range: parseRangeFrom(change),
          text: change[0],
        }));
        this.monacoModel.applyEdits(operations);
      }
    }
  }

  cleanAndUpdateContent(content) {
    this.monacoModel.setValue(content);
    (this.monacoModel as any)._commandManager.clear();
    this._persistVersionId = this.monacoModel.getVersionId();
    this.savingTasks = [];
    this.notifyChangeEvent();
  }

  async updateEncoding(encoding: string) {
    let shouldFireChange = false;
    if (this._encoding !== encoding) {
      shouldFireChange = true;
    }
    this._encoding = encoding;
    await this.reload();
    if (shouldFireChange) {
      this.eventBus.fire(new EditorDocumentModelOptionChangedEvent({
        uri: this.uri,
        encoding: this._encoding,
      }));
    }
  }

  get encoding() {
    return this._encoding;
  }

  set eol(eol) {
    this.monacoModel.setEOL(eol === EOL.LF ? EndOfLineSequence.LF : EndOfLineSequence.CRLF as any);
  }

  get eol() {
    return this.monacoModel.getEOL() as EOL;
  }

  get dirty() {
    if (!this.savable) {
      return false;
    }
    return this._persistVersionId !== this.monacoModel.getAlternativeVersionId();
  }

  set languageId(languageId) {
    monaco.editor.setModelLanguage(this.monacoModel, languageId);
    this.eventBus.fire(new EditorDocumentModelOptionChangedEvent({
      uri: this.uri,
      encoding: languageId,
    }));
  }

  get languageId() {
    return this.monacoModel.getModeId();
  }

  getMonacoModel(): monaco.editor.ITextModel {
    return this.monacoModel;
  }

  async save(force: boolean = false): Promise<boolean> {
    if (!this.preferenceService.get<boolean>('editor.askIfDiff')) {
      force = true;
    }
    if (!this.dirty) {
      return false;
    }
    const versionId = this.monacoModel.getVersionId();
    const lastSavingTask = this.savingTasks[this.savingTasks.length - 1];
    if (lastSavingTask && lastSavingTask.versionId === versionId) {
      return false;
    }
    const task = new SaveTask(this.uri, versionId, this.monacoModel.getAlternativeVersionId(), this.getText(), force);
    this.savingTasks.push(task);
    if (this.savingTasks.length === 1) {
      this.initSave();
    }
    const res = await task.finished;
    if (res.state === 'success') {
      return true;
    } else if (res.state === 'error') {
      this.logger.error(res.errorMessage);
      this.messageService.error(localize('doc.saveError.failed') + '\n' + res.errorMessage);
      return false;
    } else if (res.state === 'diff') {
      this.messageService.error(formatLocalize('doc.saveError.diff', this.uri.toString()), [localize('doc.saveError.diffAndSave')]).then((res) => {
        if (res) {
          this.compareAndSave();
        }
      });
      this.logger.error('文件无法保存，版本和磁盘不一致');
      return false;
    }
    return false;
  }

  private async compareAndSave() {
    const originalUri = URI.from({
      scheme: ORIGINAL_DOC_SCHEME,
      query: URI.stringifyQuery({
        target: this.uri.toString(),
      }),
    });
    const fileName = this.uri.path.base;
    const res = await this.compareService.compare(originalUri, this.uri, formatLocalize('editor.compareAndSave.title', fileName, fileName));
    if (res === CompareResult.revert ) {
      this.revert();
    } else if (res === CompareResult.accept ) {
      this.save(true);
    }
  }

  async initSave() {
    while (this.savingTasks.length > 0 ) {
      const res = await this.savingTasks[0].run(this.service, this.baseContent, this.getChangesFromVersion(this._persistVersionId), this.encoding);
      if (res.state === 'success' && this.savingTasks[0]) {
        this.baseContent = this.savingTasks[0].content;

        this.eventBus.fire(new EditorDocumentModelSavedEvent(this.uri));
        this.setPersist(this.savingTasks[0].alternativeVersionId);
      }
      this.savingTasks.shift();
    }
  }

  setPersist(versionId) {
    this._persistVersionId = versionId;
    this.notifyChangeEvent();
  }

  async reload() {
    try {
      const content = await this.contentRegistry.getContentForUri(this.uri, this._encoding);
      if (!isUndefinedOrNull(content)) {
        this.cleanAndUpdateContent(content);
      }
    } catch (e) {
      this._persistVersionId = this.monacoModel.getAlternativeVersionId();
    }
  }

  async revert(notOnDisk?: boolean) {
    if (notOnDisk) {
      // FIXME
      // 暂时就让它不dirty, 不是真正的revert
      this._persistVersionId = this.monacoModel.getAlternativeVersionId();
    } else {
      // 利用修改编码的副作用
      await this.updateEncoding(this._originalEncoding);
    }
  }

  getText(range?: IRange) {
    if (range) {
      return this.monacoModel.getValueInRange(range);
    } else {
      return this.monacoModel.getValue();
    }
  }

  updateContent(content: string, eol?: EOL, setPersist: boolean = false) {
    this.monacoModel.pushEditOperations([], [{
      range: this.monacoModel.getFullModelRange(),
      text: content,
    }], () => []);
    if (eol) {
      this.eol = eol;
    }
    if (setPersist) {
      this.setPersist(this.monacoModel.getAlternativeVersionId());
    }
  }

  getChangesFromVersion(versionId) {
    for (let i = this.dirtyChanges.length - 1; i >= 0; i --) {
      if (this.dirtyChanges[i].fromVersionId === versionId) {
        return this.dirtyChanges.slice(i).map((d) => {
          return {
            changes: d.changes,
          };
        });
      }
    }
    return [];
  }

  set baseContent(content: string) {
    this._baseContent = content;
    this._baseContentMd5 = null;
  }

  get baseContent() {
    return this._baseContent;
  }

  get baseContentMd5() {
    if (!this._baseContentMd5) {
      this._baseContentMd5 = md5(this._baseContent);
    }
    return this._baseContentMd5;
  }

  private notifyChangeEvent() {
    // 发出内容变化的事件
    this.eventBus.fire(new EditorDocumentModelContentChangedEvent({
      uri: this.uri,
      dirty: this.dirty,
      changes: [],
      eol: this.eol,
      versionId: this.monacoModel.getVersionId(),
    }));

    const self = this;
    this.cacheProvider.persistCache(this.uri, {
      // 使用 getter 让需要计算的数据变成 lazy 获取的
      get dirty() {
        return self.dirty;
      },
      get startMD5() {
        return self.baseContentMd5;
      },
      get content() {
        return self.getText();
      },
      get changeMatrix() {
        // 计算从起始版本到现在所有的 change 内容，然后让缓存对象进行持久化
        return self.getChangesFromVersion(self._persistVersionId)
          .map(({ changes }) => changes);
      },
      encoding: this.encoding,
    });
  }
}
