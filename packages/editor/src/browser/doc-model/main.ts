import { IEditorDocumentModel, IEditorDocumentModelContentRegistry, IEditorDocumentModelService, IEditorDocumentModelContentProvider, EditorDocumentModelCreationEvent, EditorDocumentModelContentChangedEvent, EditorDocumentModelOptionChangedEvent, IStackElement, IEditStackElement, IEOLStackElement, EditorDocumentModelOptionExternalUpdatedEvent, IEditorDocumentModelContentChange } from './types';
import { URI, Disposable, IRef, ReferenceManager, isUndefinedOrNull, IDisposable, IEventBus, ILogger, IRange, Deferred, IEditorDocumentEditChange, IEditorDocumentEOLChange, IEditOperation, IEditorDocumentChange, IEditorDocumentModelSaveResult, WithEventBus, OnEvent } from '@ali/ide-core-browser';
import { EOL, EndOfLineSequence } from '../../common';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import md5 = require('md5');

export interface EditorDocumentModelConstructionOptions {
  eol?: EOL;
  encoding?: string;
  languageId?: string;
  readonly?: boolean;
  savable?: boolean;
}

export interface IEditorDocumentModelServiceImpl extends IEditorDocumentModelService {

  saveEditorDocumentModel(uri: URI, content: string, baseContent: string, changes: IEditorDocumentChange[], encoding?: string): Promise<IEditorDocumentModelSaveResult>;

}

export class SaveTask {

  private deferred: Deferred<IEditorDocumentModelSaveResult> = new Deferred();

  public finished: Promise<IEditorDocumentModelSaveResult> = this.deferred.promise;

  public started: boolean = false;

  constructor(
    private uri: URI,
    public readonly versionId: number,
    public content: string) {

  }

  async run(service: IEditorDocumentModelServiceImpl, baseContent: string, changes: IEditorDocumentChange[], encoding?: string): Promise<IEditorDocumentModelSaveResult> {
    this.started = true;
    try {
      const res = await service.saveEditorDocumentModel(this.uri, this.content, baseContent, changes, encoding);
      this.deferred.resolve(res);
      return res;
    } catch (e) {
      const res = {
        errorMessage: e.message,
        state: 'error',
      } as any;
      this.deferred.resolve(res);
      return res;
    }
  }

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
    const task = new SaveTask(this.uri, versionId, this.getText());
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
        this._persistVersionId = this.savingTasks[0].versionId;
        this.eventBus.fire(new EditorDocumentModelContentChangedEvent({
          uri: this.uri,
          dirty: this.dirty,
          changes: [],
          eol: this.eol,
          versionId: this.monacoModel.getVersionId(),
        }));
      }
      this.savingTasks.shift();
    }
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

  updateContent(content: string, eol?: EOL) {
    this.monacoModel.setValue(content);
    if (eol) {
      this.eol = eol;
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

@Injectable()
export class EditorDocumentModelServiceImpl extends WithEventBus implements IEditorDocumentModelService {

  @Autowired(IEditorDocumentModelContentRegistry)
  contentRegistry: IEditorDocumentModelContentRegistry;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  private editorDocModels = new Map<string, EditorDocumentModel>();

  private creatingEditorModels = new Map<string, Promise<EditorDocumentModel>>();

  private _modelReferenceManager: ReferenceManager<EditorDocumentModel>;

  private _modelsToDispose = new Set<string>();

  constructor() {
    super();
    this._modelReferenceManager = new ReferenceManager<EditorDocumentModel>((key: string) => {
      if (this._modelsToDispose.has(key)) {
        this._modelsToDispose.delete(key);
      }
      return this.getOrCreateModel(key);
    });
    this._modelReferenceManager.onReferenceAllDisposed((key: string) => {
      this._delete(key);
    });
  }

  private _delete(uri: string | URI): void {
    // debounce
    this._modelsToDispose.add(uri.toString());
    setTimeout(() => {
      if (this._modelsToDispose.has(uri.toString())) {
        this._doDelete(uri.toString());
      }
    }, 3000);
  }

  private _doDelete(uri: string) {
    const doc = this.editorDocModels.get(uri);
    if (doc) {
      doc.dispose();
      this.editorDocModels.delete(uri);
      return doc;
    }
    this._modelsToDispose.delete(uri);
  }

  @OnEvent(EditorDocumentModelOptionExternalUpdatedEvent)
  async acceptExternalChange(e: EditorDocumentModelOptionExternalUpdatedEvent) {
    const doc = this.editorDocModels.get(e.payload.toString());
    if (doc) {
      if (doc.dirty) {
        // do nothing
      } else {
        const provider = this.contentRegistry.getProvider(doc.uri);
        if (provider) {
          if (provider.provideEditorDocumentModelContentMd5) {
            if (await provider.provideEditorDocumentModelContentMd5(doc.uri) !== doc.baseContentMd5) {
              doc.cleanAndUpdateContent(await this.contentRegistry.getContentForUri(doc.uri));
            }
          } else {
            const content = await this.contentRegistry.getContentForUri(doc.uri);
            if (md5(content) !== doc.baseContentMd5) {
              doc.updateContent(content);
            }
          }
        }
      }
    }
  }

  createModelReference(uri: URI, reason?: string | undefined): Promise<IRef<IEditorDocumentModel>> {
    return this._modelReferenceManager.getReference(uri.toString(), reason);
  }

  getModelReference(uri: URI, reason?: string | undefined): IRef<IEditorDocumentModel> | null {
    return this._modelReferenceManager.getReferenceIfHasInstance(uri.toString(), reason);
  }

  getAllModels(): IEditorDocumentModel[] {
    return Array.from(this.editorDocModels.values());
  }

  async getOrCreateModel(uri: string, encoding?: string): Promise<EditorDocumentModel> {
    if (this.editorDocModels.has(uri)) {
      return this.editorDocModels.get(uri)!;
    }
    return this.createModel(uri, encoding);
  }

  private createModel(uri: string, encoding?: string): Promise<EditorDocumentModel> {
    // 防止异步重复调用
    if (!this.creatingEditorModels.has(uri)) {
      const promise = this.doCreateModel(uri, encoding).then((model) => {
        this.creatingEditorModels.delete(uri);
        return model;
      }, (e) => {
        this.creatingEditorModels.delete(uri);
        throw e;
      });
      this.creatingEditorModels.set(uri, promise);
    }
    return this.creatingEditorModels.get(uri)!;
  }

  private async doCreateModel(uriString: string, encoding?: string): Promise<EditorDocumentModel> {
    const uri = new URI(uriString);
    const provider = this.contentRegistry.getProvider(uri);

    if (!provider) {
      throw new Error(`未找到${uri.toString()}的文档提供商`);
    }

    const [
      content,
      readonly,
      languageId,
      eol,
    ] = await Promise.all([
      (async () => provider.provideEditorDocumentModelContent(uri, encoding))(),
      (async () => provider.isReadonly ? provider.isReadonly(uri) : undefined)(),
      (async () => provider.preferLanguageForUri ? provider.preferLanguageForUri(uri) : undefined)(),
      (async () => provider.provideEOL ? provider.provideEOL(uri) : undefined)(),
    ]);

    const savable = !!provider.saveDocumentModel;

    const model = this.injector.get(EditorDocumentModel, [uri, content, {
      readonly,
      languageId,
      savable,
      eol,
      encoding,
    }]);

    this.editorDocModels.set(uri.toString(), model);
    return model;
  }

  async saveEditorDocumentModel(uri: URI, content: string, baseContent: string, changes: IEditorDocumentChange[], encoding?: string): Promise<IEditorDocumentModelSaveResult> {
    const provider = this.contentRegistry.getProvider(uri);

    if (!provider) {
      throw new Error(`未找到${uri.toString()}的文档提供商`);
    }
    if (!provider.saveDocumentModel) {
      throw new Error(`${uri.toString()}的文档提供商不存在保存方法`);
    }

    const result = await provider.saveDocumentModel(uri, content, baseContent, changes, encoding);
    return result;
  }
}

@Injectable()
export class EditorDocumentModelContentRegistryImpl implements IEditorDocumentModelContentRegistry {

  private providers: IEditorDocumentModelContentProvider[] = [];

  @Autowired(IEventBus)
  eventBus: IEventBus;

  registerEditorDocumentModelContentProvider(provider: IEditorDocumentModelContentProvider): IDisposable {
    this.providers.push(provider);
    const disposer = provider.onDidChangeContent((uri) => {
      this.eventBus.fire(new EditorDocumentModelOptionExternalUpdatedEvent(uri));
    });
    return {
      dispose: () => {
        disposer.dispose();
        const index = this.providers.indexOf(provider);
        if (index) {
          this.providers.splice(index, 1);
        }
      },
    };
  }

  getProvider(uri: URI): IEditorDocumentModelContentProvider | undefined {
    for (const p of this.providers) {
      if (p.handlesScheme(uri.scheme)) {
        return p;
      }
    }
  }

  async getContentForUri(uri: URI, encoding?: string ): Promise<string> {
    const p = this.getProvider(uri);
    if (!p) {
      throw new Error();
    }
    return p.provideEditorDocumentModelContent(uri, encoding);
  }

}

function isEditStack(element: IStackElement ): element is IEditStackElement {
  return !!(element as IEditStackElement).editOperations;
}

function isEOLStack(element: IStackElement ): element is IEOLStackElement {
  return !!(element as IEOLStackElement).eol;
}
