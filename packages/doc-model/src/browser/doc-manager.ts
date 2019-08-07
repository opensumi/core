import { URI, Disposable, IEventBus, Domain } from '@ali/ide-core-common';
import { Injectable, Optinal, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { callAsyncProvidersMethod } from '../common/function';
import { DocumentModel } from './doc-model';
import {
  IDocumentModelMirror,
  IDocumentModelManager,
  IDocumentModelContentProvider,
  Version,
  VersionType,
  BrowserDocumentModelContribution,
  IDocumentCreatedEvent,
  IDocumentChangedEvent,
  IDocumentRenamedEvent,
  IDocumentRemovedEvent,
  IDocumentModel,
} from '../common';
import {
  ExtensionDocumentModelChangingEvent,
  ExtensionDocumentModelOpeningEvent,
  ExtensionDocumentModelRemovingEvent,
  ExtensionDocumentModelSavingEvent,
  DocModelContentChangedEvent,
  DocModelLanguageChangeEvent,
} from './event';

@Injectable()
export class DocumentModelManager extends Disposable implements IDocumentModelManager {
  protected _modelMap: Map<string, DocumentModel>;
  protected _docModelContentProviders: Set<IDocumentModelContentProvider>;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  constructor(
    @Optinal(IEventBus) private eventBus?: IEventBus,
  ) {
    super();
    this._modelMap = new Map();
    this._docModelContentProviders = new Set();
  }

  private _delete(uri: string | URI): DocumentModel | null {
    const doc = this._modelMap.get(uri.toString());

    if (doc) {
      const model = doc.toEditor();

      this._modelMap.delete(uri.toString());
      model.dispose();

      return doc;
    }

    return null;
  }

  registerDocModelContentProvider(provider: IDocumentModelContentProvider) {
    const toDispose = new Disposable();

    this._docModelContentProviders.add(provider);

    toDispose.addDispose(provider.onCreated((e) => this.created(e)));
    toDispose.addDispose(provider.onChanged((e) => this.changed(e)));
    toDispose.addDispose(provider.onRenamed((e) => this.renamed(e)));
    toDispose.addDispose(provider.onRemoved((e) => this.removed(e)));

    return {
      dispose: () => {
        toDispose.dispose();
        this._docModelContentProviders.delete(provider);
      },
    };
  }

  getAllModels() {
    return Array.from(this._modelMap.values());
  }

  async resolveModel(uriString: string | URI): Promise<DocumentModel> {
    if (this._docModelContentProviders.size === 0) {
      throw new Error('No way to resolve content');
    }

    const uri = new URI(uriString.toString());

    const model = await this.searchModel(uri);

    if (model) {
      return model;
    }

    return this.createModel(uri);
  }

  async getPersistentMirror(uri: URI): Promise<IDocumentModelMirror | null> {
    const providers = Array.from(this._docModelContentProviders.values());
    return await callAsyncProvidersMethod<IDocumentModelMirror>(providers, 'build', uri);
  }

  async createModel(uri: URI): Promise<DocumentModel> {
    const mirror = await this.getPersistentMirror(uri);

    if (!mirror) {
      throw new Error('Resolve content failed');
    }

    const doc = DocumentModel.fromMirror(mirror, this.injector);

    doc.onContentChanged(({ changes }) => {
      if (this.eventBus) {
        this.eventBus.fire(new DocModelContentChangedEvent({
          uri: doc.uri,
          changes,
          dirty: doc.dirty,
          version: doc.version,
          eol: doc.eol,
        }));
      }
    });

    doc.onMerged(() => {
      if (this.eventBus) {
        this.eventBus.fire(new DocModelContentChangedEvent({
          uri: doc.uri,
          changes: [],
          dirty: doc.dirty,
          version: doc.version,
          eol: doc.eol,
        }));
        this.eventBus.fire(new ExtensionDocumentModelSavingEvent({
          uri: doc.uri.toString(),
        }));
      }
    });

    doc.onLanguageChanged(() => {
      if (this.eventBus) {
        this.eventBus.fire(new DocModelLanguageChangeEvent({uri: doc.uri, languageId: doc.language}));
      }
    });

    this._modelMap.set(uri.toString(), doc);

    const model = doc.toEditor();

    model.onDidChangeContent((event) => {
      if (this.eventBus) {
        const { changes } = event;
        this.eventBus.fire(new ExtensionDocumentModelChangingEvent({
          changes,
          uri: model.uri.toString(),
          eol: model.getEOL(),
          versionId: model.getVersionId(),
          dirty: doc.dirty,
        }));
      }
    });

    model.onWillDispose(() => {
      if (this.eventBus) {
        this.eventBus.fire(new ExtensionDocumentModelRemovingEvent({ uri: model.uri.toString() }));
      }
    });

    if (this.eventBus) {
      this.eventBus.fire(new ExtensionDocumentModelOpeningEvent({
        uri: model.uri.toString(),
        lines: model.getLinesContent(),
        eol: model.getEOL(),
        versionId: model.getVersionId(),
        languageId: doc.language,
        dirty: doc.dirty,
      }));
    }

    return doc;
  }

  async searchModel(uri: string | URI): Promise<DocumentModel | null> {
    const res = this._modelMap.get(uri.toString());
    return Promise.resolve(!!res ? res : null);
  }

  async saveModel(uri: string | URI, override: boolean = false) {
    const doc = await this.searchModel(uri);

    if (!doc) {
      throw new Error(`doc ${uri.toString()} not found`);
    }

    const providers = Array.from(this._docModelContentProviders.values());
    const statMirror = doc.toStatMirror();
    const mirror = await callAsyncProvidersMethod<IDocumentModelMirror>(providers, 'persist', statMirror, doc.changesStack, override);

    if (!mirror) {
      throw new Error('Save docuemnt failed');
    }

    if (doc.baseVersion.type === VersionType.browser) {
      /**
       * 这是一个保存本地不存在源文件的虚拟文档
       */
      doc.rebase(Version.from(mirror.base));
      return true;
    } else if (override) {
      /**
       * 合并完成并保存之后，需要更新前台文档的基版本到最新。
       */
      doc.merge(Version.from(mirror.base.id, mirror.base.type));
      return true;
    } else if (Version.equal(mirror.base, doc.baseVersion)) {
      /**
       * 基版本相同的时候，上面的持久化命令已完成，只需要更新基版本。
       */
      doc.merge(Version.from(mirror.base.id, mirror.base.type));
      return true;
    } else {
      /**
       * 基版本不相同的时候，我们需要进行 merge 操作，
       * 目前先直接覆盖本地文件。
       */
      const override = true;
      if (override) {
        const res = this.saveModel(uri, override);
      }
    }

    return false;
  }

  async updateContent(uri: string | URI, content: string): Promise<DocumentModel> {
    const doc = this._modelMap.get(uri.toString());

    if (!doc) {
      throw new Error('Document not found');
    }

    doc.updateContent(content);
    return doc;
  }

  async created(event: IDocumentCreatedEvent) {
    const { uri, mirror } = event;
    const doc = await this.searchModel(uri);

    /**
     * 这个文档被标记为了一个不存在在本地空间的虚拟文档，
     * 由于这个文件重新被创建了，所以我们需要 rebase 将这个文档的基版本。
     */
    if (doc && doc.baseVersion.type === VersionType.browser) {
      doc.rebase(Version.from(mirror.base));
    }

    return null;
  }

  /**
   * 当远端文件发生修改之后，会触发这个方法，
   * 判断这个文件为 dirty 的时候不做内容更新，
   * 判断这个文件为非 dirty 的时候，首先将新的基版本号更新到文档的基版本中，
   * 然后触发全量的内容修改，这个修改同时会触发 monaco 的内置数据的更新，
   * 这个更新接下来触发自己的内容修改数据的事件时可以根据两个基版本号的不一致来判断当前更改来源于一个本地修改，
   * 更新 monaco 内置数据的同时合并文本文档的编辑器版本。
   * @param event
   */
  async changed(event: IDocumentChangedEvent) {
    const { mirror, uri } = event;
    const doc = await this.searchModel(uri);

    if (!doc) {
      return null;
    }

    if (!doc.dirty) {
      doc.rebase(Version.from(mirror.base.id, mirror.base.type));
      const lines = mirror.lines || [];
      const eol = mirror.eol || '\n';
      return this.updateContent(uri, lines.join(eol));
    }

    return doc;
  }

  /**
   * 当远端文件被删除的时候，
   * 如果这个文件被在编辑器中打开或者 tab 中依然保持它的状态，
   * 这个时候我们需要把它的基版本设置为 browser 类型，
   * 这个虚拟文档的 dirty 状态一直保持为 true
   * @param event
   */
  async removed(event: IDocumentRemovedEvent) {
    const { uri } = event;
    const doc = await this.searchModel(uri);

    if (doc) {
      doc.virtual();
      this._delete(uri);
    }
  }

  async renamed(event: IDocumentRenamedEvent) {
    const { from, to } = event;
    this._delete(from);
    return this.resolveModel(to);
  }

  getAllModel(): Map<string, IDocumentModel> {
    return this._modelMap;
  }
}

@Domain(BrowserDocumentModelContribution)
export class BrowserDocumentModelContributionImpl implements BrowserDocumentModelContribution {
  @Autowired(IDocumentModelManager)
  private manager: IDocumentModelManager;

  registerDocModelContentProvider(provider: IDocumentModelContentProvider) {
    return this.manager.registerDocModelContentProvider(provider);
  }
}
