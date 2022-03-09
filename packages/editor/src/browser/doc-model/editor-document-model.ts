import debounce = require('lodash.debounce');

import { Autowired, Injectable } from '@opensumi/di';
import {
  CommandService,
  Disposable,
  Emitter,
  formatLocalize,
  IEventBus,
  ILogger,
  IRange,
  IReporterService,
  isThenable,
  isUndefinedOrNull,
  localize,
  PreferenceService,
  REPORT_NAME,
  URI,
} from '@opensumi/ide-core-browser';
import { IHashCalculateService } from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';
import { monaco, URI as MonacoURI } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { EOL, EndOfLineSequence, ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { IMessageService } from '@opensumi/ide-overlay';

import {
  IDocCache,
  IDocPersistentCacheProvider,
  isDocContentCache,
  parseRangeFrom,
  SaveReason,
  IEditorDocumentModelContentChange,
} from '../../common';
import { EditorPreferences } from '../preference/schema';
import { createEditorPreferenceProxy } from '../preference/util';
import { CompareResult, ICompareService } from '../types';

import { EditorDocumentError } from './editor-document-error';
import { IEditorDocumentModelServiceImpl, SaveTask } from './save-task';
import {
  EditorDocumentModelContentChangedEvent,
  EditorDocumentModelOptionChangedEvent,
  EditorDocumentModelRemovalEvent,
  EditorDocumentModelSavedEvent,
  IEditorDocumentModel,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelService,
  ORIGINAL_DOC_SCHEME,
  EditorDocumentModelWillSaveEvent,
} from './types';


export interface EditorDocumentModelConstructionOptions {
  eol?: EOL;
  encoding?: string;
  languageId?: string;
  readonly?: boolean;
  savable?: boolean;
  alwaysDirty?: boolean;
  closeAutoSave?: boolean;
}

export interface IDirtyChange {
  fromVersionId: number;
  toVersionId: number;
  changes: IEditorDocumentModelContentChange[];
}

@Injectable({ multiple: true })
export class EditorDocumentModel extends Disposable implements IEditorDocumentModel {
  @Autowired(IEditorDocumentModelContentRegistry)
  contentRegistry: IEditorDocumentModelContentRegistry;

  @Autowired(IEditorDocumentModelService)
  service: IEditorDocumentModelServiceImpl;

  @Autowired(ICompareService)
  compareService: ICompareService;

  @Autowired(IDocPersistentCacheProvider)
  cacheProvider: IDocPersistentCacheProvider;

  editorPreferences: EditorPreferences;

  @Autowired(IMessageService)
  messageService: IMessageService;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired(IReporterService)
  private reporter: IReporterService;

  @Autowired(PreferenceService)
  preferences: PreferenceService;

  @Autowired(IHashCalculateService)
  private readonly hashCalculateService: IHashCalculateService;

  private monacoModel: ITextModel;

  public _encoding = 'utf8';

  public readonly readonly: boolean = false;

  public readonly savable: boolean = false;

  public readonly alwaysDirty: boolean = false;

  public readonly closeAutoSave: boolean = false;

  private _originalEncoding: string = this._encoding;

  private _persistVersionId = 0;

  private _baseContent = '';

  private _baseContentMd5: string | null;

  private savingTasks: SaveTask[] = [];

  private dirtyChanges: IDirtyChange[] = [];

  private _previousVersionId: number;

  private _tryAutoSaveAfterDelay: (() => any) | undefined;

  private _isInitOption = true;

  private readonly _onDidChangeEncoding = new Emitter<void>();
  readonly onDidChangeEncoding = this._onDidChangeEncoding.event;

  constructor(public readonly uri: URI, content: string, options: EditorDocumentModelConstructionOptions = {}) {
    super();

    this.onDispose(() => {
      this.eventBus.fire(new EditorDocumentModelRemovalEvent(this.uri));
    });
    if (options.encoding) {
      this._encoding = options.encoding;
    }
    this.readonly = !!options.readonly;
    this.savable = !!options.savable;
    this.alwaysDirty = !!options.alwaysDirty;
    this.closeAutoSave = !!options.closeAutoSave;

    this.monacoModel = monaco.editor.createModel(content, options.languageId, MonacoURI.parse(uri.toString()));
    this.editorPreferences = createEditorPreferenceProxy(this.preferences, this.uri.toString(), this.languageId);
    this.updateOptions({});
    if (options.eol) {
      this.eol = options.eol;
    }
    this._originalEncoding = this._encoding;
    this._previousVersionId = this.monacoModel.getVersionId();
    this._persistVersionId = this.monacoModel.getAlternativeVersionId();
    this.baseContent = content;

    this._isInitOption = false;
    this.listenTo(this.monacoModel);
    this.readCacheToApply();

    this.addDispose(this._onDidChangeEncoding);
  }

  updateOptions(options) {
    const finalOptions = {
      tabSize: this.editorPreferences['editor.tabSize'] || 1,
      insertSpaces: this.editorPreferences['editor.insertSpaces'],
      detectIndentation: this.editorPreferences['editor.detectIndentation'],
      ...options,
    };
    if (finalOptions.detectIndentation) {
      this.monacoModel.detectIndentation(finalOptions.insertSpaces, finalOptions.tabSize);
    } else {
      this.monacoModel.updateOptions(finalOptions);
    }
  }

  private listenTo(monacoModel: ITextModel) {
    monacoModel.onDidChangeContent((e) => {
      if (e.changes && e.changes.length > 0) {
        this.dirtyChanges.push({
          fromVersionId: this._previousVersionId,
          toVersionId: e.versionId,
          changes: e.changes,
        });
      }
      this._previousVersionId = e.versionId;
      this.notifyChangeEvent(e.changes, e.isRedoing, e.isUndoing);
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
      this.logger.error(EditorDocumentError.APPLY_CACHE_TO_DIRTY_DOCUMENT);
      return;
    }

    if (this.baseContentMd5 !== cache.startMD5) {
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
    this._persistVersionId = this.monacoModel.getAlternativeVersionId();
    this.savingTasks = [];
    this.notifyChangeEvent([], false, false);
    this.baseContent = content;
  }

  async updateEncoding(encoding: string) {
    let shouldFireChange = false;
    if (this._encoding !== encoding) {
      shouldFireChange = true;
    }
    this._encoding = encoding;
    await this.reload();
    if (shouldFireChange) {
      this.eventBus.fire(
        new EditorDocumentModelOptionChangedEvent({
          uri: this.uri,
          encoding: this._encoding,
        }),
      );
      this._onDidChangeEncoding.fire();
    }
  }

  get encoding() {
    return this._encoding;
  }

  set eol(eol) {
    this.monacoModel.setEOL(eol === EOL.LF ? EndOfLineSequence.LF : (EndOfLineSequence.CRLF as any));
    if (!this._isInitOption) {
      this.eventBus.fire(
        new EditorDocumentModelOptionChangedEvent({
          uri: this.uri,
          eol,
        }),
      );
    }
  }

  get eol() {
    return this.monacoModel.getEOL() as EOL;
  }

  get dirty() {
    if (this.alwaysDirty) {
      return true;
    }
    if (!this.savable) {
      return false;
    }
    if (this.monacoModel.isDisposed()) {
      return false;
    }
    return this._persistVersionId !== this.monacoModel.getAlternativeVersionId();
  }

  set languageId(languageId) {
    monaco.editor.setModelLanguage(this.monacoModel, languageId);
    this.eventBus.fire(
      new EditorDocumentModelOptionChangedEvent({
        uri: this.uri,
        languageId,
      }),
    );
  }

  get languageId() {
    return this.monacoModel.getModeId();
  }

  get id() {
    return this.monacoModel.id;
  }

  getMonacoModel(): ITextModel {
    return this.monacoModel;
  }

  async save(force = false, reason: SaveReason = SaveReason.Manual): Promise<boolean> {
    await this.formatOnSave(reason);
    // 发送willSave并等待完成
    await this.eventBus.fireAndAwait(
      new EditorDocumentModelWillSaveEvent({
        uri: this.uri,
        reason,
        language: this.languageId,
      }),
    );
    if (!this.editorPreferences['editor.askIfDiff']) {
      force = true;
    }
    // 新建的文件也可以保存
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
      this.messageService
        .error(formatLocalize('doc.saveError.diff', this.uri.toString()), [localize('doc.saveError.diffAndSave')])
        .then((res) => {
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
    const res = await this.compareService.compare(
      originalUri,
      this.uri,
      formatLocalize('editor.compareAndSave.title', fileName, fileName),
    );
    if (res === CompareResult.revert) {
      this.revert();
    } else if (res === CompareResult.accept) {
      this.save(true);
    }
  }

  async initSave() {
    while (this.savingTasks.length > 0) {
      const changes = this.dirtyChanges;
      this.dirtyChanges = [];
      const res = await this.savingTasks[0].run(this.service, this.baseContent, changes, this.encoding, this.eol);
      if (res.state === 'success' && this.savingTasks[0]) {
        this.baseContent = this.savingTasks[0].content;

        this.eventBus.fire(new EditorDocumentModelSavedEvent(this.uri));
        this.setPersist(this.savingTasks[0].alternativeVersionId);
      } else {
        // 回滚 changes
        this.dirtyChanges.unshift(...changes);
      }
      this.savingTasks.shift();
    }
  }

  setPersist(versionId: number) {
    this._persistVersionId = versionId;
    this.notifyChangeEvent([], false, false);
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
      // FIXME: 暂时就让它不 dirty, 不是真正的 revert
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

  updateContent(content: string, eol?: EOL, setPersist = false) {
    this.monacoModel.pushEditOperations(
      [],
      [
        {
          range: this.monacoModel.getFullModelRange(),
          text: content,
        },
      ],
      () => [],
    );
    if (eol) {
      this.eol = eol;
    }
    if (setPersist) {
      this.setPersist(this.monacoModel.getAlternativeVersionId());
      this.baseContent = content;
      this.dirtyChanges = [];
    }
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
      this._baseContentMd5 = this.hashCalculateService.calculate(this._baseContent);
    }
    return this._baseContentMd5;
  }

  get tryAutoSaveAfterDelay() {
    if (!this._tryAutoSaveAfterDelay) {
      this._tryAutoSaveAfterDelay = debounce(() => {
        this.save(undefined, SaveReason.AfterDelay);
      }, this.editorPreferences['editor.autoSaveDelay'] || 1000);
      this.addDispose(
        this.editorPreferences.onPreferenceChanged((change) => {
          if (change.preferenceName === 'editor.autoSaveDelay') {
            this._tryAutoSaveAfterDelay = debounce(() => {
              this.save(undefined, SaveReason.AfterDelay);
            }, this.editorPreferences['editor.autoSaveDelay'] || 1000);
          }
        }),
      );
    }
    return this._tryAutoSaveAfterDelay;
  }

  getBaseContentMd5(): string {
    if (!this._baseContentMd5) {
      this._baseContentMd5 = this.hashCalculateService.calculate(this._baseContent);
    }
    return this._baseContentMd5!;
  }

  private notifyChangeEvent(changes: IEditorDocumentModelContentChange[] = [], isRedoing: boolean, isUndoing: boolean) {
    if (!this.closeAutoSave && this.savable && this.editorPreferences['editor.autoSave'] === 'afterDelay') {
      this.tryAutoSaveAfterDelay();
    }
    // 发出内容变化的事件
    this.eventBus.fire(
      new EditorDocumentModelContentChangedEvent({
        uri: this.uri,
        dirty: this.dirty,
        changes,
        eol: this.eol,
        isRedoing,
        isUndoing,
        versionId: this.monacoModel.getVersionId(),
      }),
    );

    const self = this;
    this.cacheProvider.persistCache(this.uri, {
      // 使用 getter 让需要计算的数据变成 lazy 获取的
      get dirty() {
        return self.dirty;
      },
      get startMD5() {
        return self.getBaseContentMd5();
      },
      get content() {
        return self.getText();
      },
      get changeMatrix() {
        // 计算从起始版本到现在所有的 change 内容，然后让缓存对象进行持久化
        return self.dirtyChanges.map(({ changes }) => changes);
      },
      encoding: this.encoding,
    });
  }

  protected async formatOnSave(reason: SaveReason) {
    const formatOnSave = this.editorPreferences['editor.formatOnSave'];

    // 和 vscode 逻辑保持一致，如果是 AfterDelay 则不执行 formatOnSave
    if (formatOnSave && reason !== SaveReason.AfterDelay) {
      const formatOnSaveTimeout = this.editorPreferences['editor.formatOnSaveTimeout'] || 3000;
      const timer = this.reporter.time(REPORT_NAME.FORMAT_ON_SAVE);
      try {
        await Promise.race([
          new Promise((_, reject) => {
            setTimeout(() => {
              const err = new Error(formatLocalize('preference.editor.formatOnSaveTimeoutError', formatOnSaveTimeout));
              err.name = 'FormatOnSaveTimeoutError';
              reject(err);
            }, formatOnSaveTimeout);
          }),
          this.commandService.executeCommand('editor.action.formatDocument'),
        ]);
      } catch (err) {
        if (err.name === 'FormatOnSaveTimeoutError') {
          this.reporter.point(REPORT_NAME.FORMAT_ON_SAVE_TIMEOUT_ERROR, this.uri.toString());
        }
        // 目前 command 没有读取到 contextkey，在不支持 format 的地方执行 format 命令会报错，先警告下，后续要接入 contextkey 来判断
        this.logger.warn(`${EditorDocumentError.FORMAT_ERROR} ${err && err.message}`);
      } finally {
        timer.timeEnd(this.uri.path.ext);
      }
    }
  }
}
