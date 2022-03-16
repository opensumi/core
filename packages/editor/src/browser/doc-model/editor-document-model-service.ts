import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  URI,
  IRef,
  ReferenceManager,
  IEditorDocumentChange,
  IEditorDocumentModelSaveResult,
  WithEventBus,
  OnEvent,
  StorageProvider,
  IStorage,
  STORAGE_SCHEMA,
  ILogger,
  PreferenceService,
  ReadyEvent,
  memoize,
} from '@opensumi/ide-core-browser';
import { IHashCalculateService } from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';
import { mapToSerializable, serializableToMap } from '@opensumi/ide-core-common/lib/map';
import { EOL } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

import { EditorDocumentModel } from './editor-document-model';
import {
  IEditorDocumentModel,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelService,
  EditorDocumentModelOptionExternalUpdatedEvent,
  EditorDocumentModelCreationEvent,
  IPreferredModelOptions,
} from './types';

export const EDITOR_DOCUMENT_MODEL_STORAGE: URI = new URI('editor-doc').withScheme(STORAGE_SCHEMA.SCOPE);

export const EDITOR_DOC_OPTIONS_PREF_KEY = 'editor_doc_pref';

@Injectable()
export class EditorDocumentModelServiceImpl extends WithEventBus implements IEditorDocumentModelService {
  @Autowired(IEditorDocumentModelContentRegistry)
  contentRegistry: IEditorDocumentModelContentRegistry;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(StorageProvider)
  getStorage: StorageProvider;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(IHashCalculateService)
  private readonly hashCalculateService: IHashCalculateService;

  private storage: IStorage;

  private editorDocModels = new Map<string, EditorDocumentModel>();

  private creatingEditorModels = new Map<string, Promise<EditorDocumentModel>>();

  private _modelReferenceManager: ReferenceManager<EditorDocumentModel>;

  private _modelsToDispose = new Set<string>();

  private preferredModelOptions = new Map<string, IPreferredModelOptions>();

  private _ready = new ReadyEvent<void>();

  constructor() {
    super();
    this._modelReferenceManager = new ReferenceManager<EditorDocumentModel>((key: string) => {
      if (this._modelsToDispose.has(key)) {
        this._modelsToDispose.delete(key);
      }
      // this.getOrCreateModel 的第二个参数是 encoding, 实际上没地方能传进去
      // ReferenceManager 的构造参数 factory 只有一个入参
      return this.getOrCreateModel(key);
    });
    this._modelReferenceManager.onReferenceAllDisposed((key: string) => {
      this._delete(key);
    });
    this._modelReferenceManager.onInstanceCreated((model) => {
      this.eventBus.fire(
        new EditorDocumentModelCreationEvent({
          uri: model.uri,
          languageId: model.languageId,
          eol: model.eol,
          encoding: model.encoding,
          content: model.getText(),
          readonly: model.readonly,
          versionId: model.getMonacoModel().getVersionId(),
        }),
      );
    });
    this.addDispose(
      this.preferenceService.onPreferenceChanged((e) => {
        if (e.preferenceName === 'editor.detectIndentation') {
          this.editorDocModels.forEach((m) => {
            m.updateOptions({});
          });
        }
      }),
    );
  }

  private _delete(uri: string | URI): void {
    const modelDisposeDebounceTime = this.preferenceService.get<number>('editor.modelDisposeTime', 3000);
    // debounce
    this._modelsToDispose.add(uri.toString());
    let timer: number | null = null;
    const disposer = this.addDispose({
      dispose: () => {
        if (timer) {
          clearTimeout(timer);
        }
      },
    });
    timer = window.setTimeout(() => {
      disposer.dispose();
      timer = null;
      if (this._modelsToDispose.has(uri.toString())) {
        this._doDelete(uri.toString());
      }
    }, modelDisposeDebounceTime);
  }

  private _doDelete(uri: string) {
    const doc = this.editorDocModels.get(uri);
    // dirty 的 document 不 dispose
    if (doc && !doc.dirty) {
      doc.dispose();
      this.editorDocModels.delete(uri);
      return doc;
    }
    this._modelsToDispose.delete(uri);
  }

  async changeModelOptions(uri: URI, options: IPreferredModelOptions) {
    return this.onceReady(() => {
      if (this.preferredModelOptions.has(uri.toString())) {
        options = {
          ...this.preferredModelOptions.get(uri.toString()),
          ...options,
        };
      }
      this.preferredModelOptions.set(uri.toString(), options);
      const docRef = this.getModelReference(uri);
      if (docRef) {
        if (options.encoding && options.encoding !== docRef.instance.encoding) {
          docRef.instance.updateEncoding(options.encoding);
        }
        if (options.languageId && options.languageId !== docRef.instance.languageId) {
          docRef.instance.languageId = options.languageId;
        }
        if (options.eol && options.eol !== docRef.instance.eol) {
          docRef.instance.eol = options.eol;
        }
        docRef.dispose();
      }
      return this.persistOptionsPreference();
    });
  }

  persistOptionsPreference() {
    return this.storage.set(EDITOR_DOC_OPTIONS_PREF_KEY, JSON.stringify(mapToSerializable(this.preferredModelOptions)));
  }

  @memoize
  async initialize() {
    this.storage = await this.getStorage(EDITOR_DOCUMENT_MODEL_STORAGE);
    if (this.storage.get(EDITOR_DOC_OPTIONS_PREF_KEY)) {
      try {
        this.preferredModelOptions = serializableToMap(JSON.parse(this.storage.get(EDITOR_DOC_OPTIONS_PREF_KEY)!));
      } catch (e) {
        this.logger.error(e);
      }
    }
    this._ready.ready();
  }

  @OnEvent(EditorDocumentModelOptionExternalUpdatedEvent)
  async acceptExternalChange(e: EditorDocumentModelOptionExternalUpdatedEvent) {
    const doc = this.editorDocModels.get(e.payload.toString());
    if (doc) {
      if (doc.dirty) {
        // do nothing
      } else {
        const provider = await this.contentRegistry.getProvider(doc.uri);
        if (provider) {
          if (provider.provideEditorDocumentModelContentMd5) {
            const nextMd5 = await provider.provideEditorDocumentModelContentMd5(doc.uri, doc.encoding);
            if (nextMd5 !== doc.getBaseContentMd5()) {
              doc.updateContent(await this.contentRegistry.getContentForUri(doc.uri, doc.encoding), undefined, true);
            }
          } else {
            const content = await this.contentRegistry.getContentForUri(doc.uri, doc.encoding);
            if (this.hashCalculateService.calculate(content) !== doc.getBaseContentMd5()) {
              doc.updateContent(content, undefined, true);
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

  hasLanguage(langaugeId) {
    return this.getAllModels().findIndex((m) => m.languageId === langaugeId) !== -1;
  }

  async getOrCreateModel(uri: string, encoding?: string): Promise<EditorDocumentModel> {
    if (this.editorDocModels.has(uri)) {
      return this.editorDocModels.get(uri)!;
    }
    return this.createModel(uri, encoding);
  }

  private get onceReady() {
    this.initialize();
    return this._ready.onceReady.bind(this._ready);
  }

  private createModel(uri: string, encoding?: string): Promise<EditorDocumentModel> {
    // 防止异步重复调用
    if (!this.creatingEditorModels.has(uri)) {
      const promise = this.onceReady(() => this.doCreateModel(uri, encoding)).then(
        (model) => {
          this.creatingEditorModels.delete(uri);
          return model;
        },
        (e) => {
          this.creatingEditorModels.delete(uri);
          throw e;
        },
      );
      this.creatingEditorModels.set(uri, promise);
    }
    return this.creatingEditorModels.get(uri)!;
  }

  private async doCreateModel(uriString: string, encoding?: string): Promise<EditorDocumentModel> {
    const uri = new URI(uriString);
    const provider = await this.contentRegistry.getProvider(uri);

    if (!provider) {
      throw new Error(`未找到${uri.toString()}的文档提供商`);
    }

    const preferedOptions = this.preferredModelOptions.get(uri.toString());

    if (!encoding && provider.provideEncoding) {
      if (preferedOptions && preferedOptions.encoding) {
        encoding = preferedOptions.encoding;
      }
    }

    const preferredLanguage = preferedOptions && preferedOptions.languageId;

    const [content, readonly, languageId, eol, alwaysDirty, closeAutoSave] = await Promise.all([
      (async () => provider.provideEditorDocumentModelContent(uri, encoding))(),
      (async () => (provider.isReadonly ? provider.isReadonly(uri) : undefined))(),
      (async () =>
        preferredLanguage
          ? preferredLanguage
          : provider.preferLanguageForUri
          ? provider.preferLanguageForUri(uri)
          : undefined)(),
      (async () => preferedOptions?.eol || (provider.provideEOL ? provider.provideEOL(uri) : undefined))(),
      (async () => (provider.isAlwaysDirty ? provider.isAlwaysDirty(uri) : false))(),
      (async () => (provider.closeAutoSave ? provider.closeAutoSave(uri) : false))(),
    ] as const);

    // 优先使用 preferred encoding，然后用 detected encoding
    if (!encoding && provider.provideEncoding) {
      encoding = await provider.provideEncoding(uri);
    }

    const savable = !!provider.saveDocumentModel;

    const model = this.injector.get(EditorDocumentModel, [
      uri,
      content,
      {
        readonly,
        languageId,
        savable,
        eol,
        encoding,
        alwaysDirty,
        closeAutoSave,
      },
    ]);

    this.editorDocModels.set(uri.toString(), model);
    return model;
  }

  async saveEditorDocumentModel(
    uri: URI,
    content: string,
    baseContent: string,
    changes: IEditorDocumentChange[],
    encoding?: string,
    ignoreDiff?: boolean,
    eol?: EOL,
  ): Promise<IEditorDocumentModelSaveResult> {
    const provider = await this.contentRegistry.getProvider(uri);

    if (!provider) {
      throw new Error(`未找到${uri.toString()}的文档提供商`);
    }
    if (!provider.saveDocumentModel) {
      throw new Error(`${uri.toString()}的文档提供商不存在保存方法`);
    }

    const result = await provider.saveDocumentModel(uri, content, baseContent, changes, encoding, ignoreDiff, eol);
    return result;
  }

  dispose() {
    super.dispose();
    this.getAllModels().forEach((model) => {
      model.getMonacoModel().dispose();
    });
  }
}
