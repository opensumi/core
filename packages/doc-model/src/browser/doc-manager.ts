import { URI, Disposable, IEventBus } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { callAsyncProvidersMethod } from '../common/function';
import { DocumentModel } from './doc-model';
import {
  IDocumentModelMirror,
  IDocumentModelManager,
  IDocumentModeContentProvider,
  IDocumentCreatedEvent,
  IDocumentChangedEvent,
  IDocumentRenamedEvent,
  IDocumentRemovedEvent,
  Version,
} from '../common';
import {
  RemoteProvider,
  EmptyProvider,
} from './provider';
import { DocModelContentChangedEvent } from './event';

@Injectable()
export class DocumentModelManager extends Disposable implements IDocumentModelManager {
  @Autowired()
  private remoteProvider: RemoteProvider;
  @Autowired()
  private emptyProvider: EmptyProvider;
  @Autowired(IEventBus)
  private eventBus: IEventBus;

  protected _modelMap: Map<string, DocumentModel>;
  protected _docModelContentProviders: Set<IDocumentModeContentProvider>;

  constructor() {
    super();
    this._modelMap = new Map();
    this._docModelContentProviders = new Set();
    this.registerDocModelContentProvider(this.remoteProvider);
    this.registerDocModelContentProvider(this.emptyProvider);
  }

  private _delete(uri: string | URI): DocumentModel | null {
    const doc = this._modelMap.get(uri.toString());

    if (doc) {
      this._modelMap.delete(uri.toString());
      return doc;
    }

    return null;
  }

  registerDocModelContentProvider(provider: IDocumentModeContentProvider) {
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

  /**
   * @override
   */
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

  async createModel(uri: URI): Promise<DocumentModel> {
    const providers = Array.from(this._docModelContentProviders.values());
    const mirror = await callAsyncProvidersMethod<IDocumentModelMirror>(providers, 'build', uri);

    if (!mirror) {
      throw new Error('Resolve content failed');
    }

    const doc = DocumentModel.fromMirror(mirror);

    doc.onContentChanged(() => {
      this.eventBus.fire(new DocModelContentChangedEvent({
        uri: doc.uri,
        changes: [],
        dirty: doc.dirty,
      }));
    });

    doc.onMerged(() => {
      this.eventBus.fire(new DocModelContentChangedEvent({
        uri: doc.uri,
        changes: [],
        dirty: doc.dirty,
      }));
    });

    this._modelMap.set(uri.toString(), doc);
    return doc;
  }

  /**
   * @override
   */
  async searchModel(uri: string | URI): Promise<DocumentModel | null> {
    const res = this._modelMap.get(uri.toString());
    return Promise.resolve(!!res ? res : null);
  }

  async savetModel(uri: string | URI, override: boolean = false) {
    const doc = await this.searchModel(uri);

    if (!doc) {
      throw new Error(`doc ${uri.toString()} not found`);
    }

    const providers = Array.from(this._docModelContentProviders.values());
    const mirror = await callAsyncProvidersMethod<IDocumentModelMirror>(providers, 'persist', doc.toMirror(), override);

    if (!mirror) {
      throw new Error('Save docuemnt failed');
    }

    if (override) {
      /**
       * 合并完成并保存之后，需要更新前台文档的基版本到最新。
       */
      doc.merged(Version.from(mirror.base.id, mirror.base.type));
      return true;
    } else if (Version.equal(mirror.base, doc.baseVersion)) {
      /**
       * 基版本相同的时候，上面的持久化命令已完成，只需要更新基版本。
       */
      doc.merged(Version.from(mirror.base.id, mirror.base.type));
      return true;
    } else {
      /**
       * 基版本不相同的时候，我们需要进行 merge 操作，
       * 目前先直接覆盖本地文件。
       */
      const override = true;
      if (override) {
        const res = this.savetModel(uri, override);
      }
    }

    return false;
  }

  /**
   * @override
   */
  async updateContent(uri: string | URI, content: string): Promise<DocumentModel> {
    const doc = this._modelMap.get(uri.toString());

    if (!doc) {
      throw new Error('Document not found');
    }

    doc.updateContent(content);
    return doc;
  }

  /**
   * @override
   */
  async created(event: IDocumentCreatedEvent) {
    return null;
  }

  /**
   * @override
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
   * @override
   */
  async renamed(event: IDocumentRenamedEvent) {
    const { from, to } = event;
    this._delete(from);
    return this.resolveModel(to);
  }

  /**
   * @override
   */
  async removed(event: IDocumentRemovedEvent) {
    const { uri } = event;
    const doc = await this.searchModel(uri);

    if (doc) {
      this._delete(uri);
    }
  }
}
