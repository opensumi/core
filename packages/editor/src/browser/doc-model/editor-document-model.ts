import * as md5 from 'md5';
import { URI, Disposable, isUndefinedOrNull, IEventBus, ILogger, IRange, IEditorDocumentEditChange } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';

import { EOL, EndOfLineSequence } from '../../common';
import { IEditorDocumentModel, IEditorDocumentModelContentRegistry, IEditorDocumentModelService, EditorDocumentModelCreationEvent, EditorDocumentModelContentChangedEvent, EditorDocumentModelOptionChangedEvent, IEditorDocumentModelContentChange, EditorDocumentModelSavedEvent } from './types';
import { IEditorDocumentModelServiceImpl, SaveTask } from './save-task';

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
    this.addDispose(this.monacoModel);
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
    this.monacoModel.onDidChangeContent((e) => {
      this.eventBus.fire(new EditorDocumentModelContentChangedEvent({
        uri: this.uri,
        dirty: this.dirty,
        changes: e.changes,
        eol: e.eol,
        versionId: e.versionId,
      }));
      if (e.changes && e.changes.length > 0) {
        this.dirtyChanges.push({
          fromVersionId: this._previousVersionId,
          toVersionId: e.versionId,
          changes: e.changes,
        });
      }
      this._previousVersionId = e.versionId;
    });
    this._persistVersionId = this.monacoModel.getAlternativeVersionId();
    this.baseContent = content;
  }

  cleanAndUpdateContent(content) {
    this.monacoModel.setValue(content);
    (this.monacoModel as any)._commandManager.clear();
    this.eventBus.fire(new EditorDocumentModelContentChangedEvent({
      uri: this.uri,
      dirty: this.dirty,
      eol: this.eol,
      changes: [],
      versionId: this.monacoModel.getVersionId(),
    }));
    this._persistVersionId = this.monacoModel.getVersionId();
    this.savingTasks = [];
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

  async save(treatDiffAsError?: boolean | undefined): Promise<boolean> {
    if (!this.dirty) {
      return false;
    }
    const versionId = this.monacoModel.getVersionId();
    const lastSavingTask = this.savingTasks[this.savingTasks.length - 1];
    if (lastSavingTask && lastSavingTask.versionId === versionId) {
      return false;
    }
    const task = new SaveTask(this.uri, versionId, this.monacoModel.getAlternativeVersionId(), this.getText());
    this.savingTasks.push(task);
    if (this.savingTasks.length === 1) {
      this.initSave();
    }
    const res = await task.finished;
    if (res.state === 'success') {
      return true;
    } else if (res.state === 'error') {
      this.logger.error(res.errorMessage);
      return false;
    } else if (res.state === 'diff') {
      if (treatDiffAsError) {
        this.logger.error('文件无法保存，版本和磁盘不一致');
        return false;
      } else {
        this.logger.error('文件无法保存，版本和磁盘不一致');
        return false;
      }
    }
    return false;
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
    this.eventBus.fire(new EditorDocumentModelContentChangedEvent({
      uri: this.uri,
      dirty: this.dirty,
      changes: [],
      eol: this.eol,
      versionId: this.monacoModel.getVersionId(),
    }));
  }

  async reload() {
    const content = await this.contentRegistry.getContentForUri(this.uri, this._encoding);
    if (!isUndefinedOrNull(content)) {
      this.cleanAndUpdateContent(content);
    }
  }

  async revert() {
    // 利用修改编码的副作用
    this.updateEncoding(this._originalEncoding);
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

  getChangesFromVersion(versionId): Array<IEditorDocumentEditChange> {
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

}
