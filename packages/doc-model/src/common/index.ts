import {
  DisposableRef,
  IDisposable, Disposable,
  URI, Event,
} from '@ali/ide-core-common';
import {
  IDocumentModel,
  IDocumentModelProvider,
  IDocumentCreatedEvent,
  IDocumentChangedEvent,
  IDocumentRenamedEvent,
  IDocumentRemovedEvent,
  IDocumentModelMirror,
} from './doc';

export type IDocModelResolver = (uri: string | URI) => Promise<IDocumentModel | null>;

export interface IDocumentModelManager extends IDisposable {
  open(uri: string | URI): Promise<IDocumentModel | null>;
  close(uri: string | URI): Promise<IDocumentModel | null>;
  update(uri: string | URI, next: IDocumentModelMirror): Promise<IDocumentModel | null>;
  search(uri: string | URI): Promise<IDocumentModel | null>;
  registerDocModelProvider(provider: IDocumentModelProvider): IDisposable;

  // TODO: more functions
}

export class DocumentModel extends DisposableRef<DocumentModel> implements IDocumentModel {
  private _uri: URI;
  private _eol: string;
  private _lines: string[];
  private _encoding: string;
  private _language: string;
  private _dirty: boolean;

  static fromMirror(mirror: IDocumentModelMirror) {
    const docModel = new DocumentModel();
    docModel.fromMirror(mirror);
    return docModel;
  }

  constructor(uri?: string | URI, eol?: string, lines?: string[], encoding?: string, language?: string) {
    super();
    // @ts-ignore
    this._uri = uri ? new URI(uri.toString()) : null;
    this._eol = eol || '\n';
    this._lines = lines || [''];
    this._encoding = encoding || 'utf-8';
    this._language = language || 'plaintext';
    this._dirty = false;

    this.addDispose({
      dispose: () => {
        // @ts-ignore
        this._uri = null;
        this._lines = [];
        this._eol = '';
        this._encoding = '';
        this._language = '';
        this._dirty = false;
      }
    });
  }

  get uri() {
    return this._uri;
  }

  get eol() {
    return this._eol;
  }

  get lines() {
    return this._lines;
  }

  get encoding() {
    return this._encoding;
  }

  get language() {
    return this._language;
  }

  get dirty() {
    return this._dirty;
  }

  // @overide
  toEditor() {
    return null;
  }

  toMirror() {
    return {
      uri: this._uri.toString(),
      lines: this.lines,
      eol: this.eol,
      encoding: this.encoding,
      language: this.language,
    };
  }

  fromMirror(mirror: IDocumentModelMirror) {
    mirror.uri && (this._uri = new URI(mirror.uri));
    mirror.lines && (this._lines = mirror.lines);
    mirror.eol && (this._eol = mirror.eol);
    mirror.encoding && (this._encoding = mirror.encoding);
    mirror.language && (this._language = mirror.language);
  }

  get onDispose() {
    return super.onDispose;
  }
}

export class DocumentModelManager extends Disposable implements IDocumentModelManager {
  private _modelMap: Map<string, IDocumentModel>;
  private _docModelProvider?: IDocumentModelProvider;

  static nullProvider = () => Promise.resolve(null);

  constructor() {
    super();
    this._modelMap = new Map();
  }

  registerDocModelProvider(provider: IDocumentModelProvider) {
    const toDispose = new Disposable();
    this._docModelProvider = provider;

    toDispose.addDispose(this._docModelProvider.onCreated((e) => this.created(e)));
    toDispose.addDispose(this._docModelProvider.onChanged((e) => this.changed(e)));
    toDispose.addDispose(this._docModelProvider.onRenamed((e) => this.renamed(e)));
    toDispose.addDispose(this._docModelProvider.onRemoved((e) => this.removed(e)));

    return {
      dispose: () => {
        toDispose.dispose();
        this._docModelProvider = undefined;
      },
    }
  }

  // @override
  async open(uri: string | URI): Promise<IDocumentModel | null> {
    if (!this._docModelProvider) {
      return null;
    }

    const doc = await this._docModelProvider.build(uri);
    const { dispose } = this._docModelProvider.watch(uri);

    if (doc) {
      this._modelMap.set(uri.toString(), doc);
      doc.onDispose(() => dispose());
      return doc;
    }

    return null;
  }

  // @override
  async close(uri: string | URI): Promise<IDocumentModel | null> {
    const doc = this._modelMap.get(uri.toString());

    if (doc) {
      this._modelMap.delete(uri.toString());
      return doc;
    }

    return null;
  }

  // @override
  async update(uri: string | URI, mirror: IDocumentModelMirror): Promise<IDocumentModel | null> {
    const doc = this._modelMap.get(uri.toString());

    if (doc) {
      doc.fromMirror(mirror);
      return doc;
    }

    return null;
  }

  // @override
  async search(uri: string | URI): Promise<IDocumentModel | null> {
    const res = this._modelMap.get(uri.toString());
    return Promise.resolve(!!res ? res : null);
  }

  // @override
  async created(event: IDocumentCreatedEvent) {
    return null;
  }

  // @override
  async changed(event: IDocumentChangedEvent) {
    const { uri, mirror } = event;

    return this.update(uri, mirror);
  }

  // @override
  async renamed(event: IDocumentRenamedEvent) {
    const { from, to } = event;

    return this.update(from, { uri: to.toString() });
  }

  // @override
  async removed(event: IDocumentRemovedEvent) {
    const { uri } = event;
    const doc = await this.search(uri);

    if (doc) {
      const res = await this.close(uri);
      if (res) {
        res.dispose();
      }
    }
  }
}
