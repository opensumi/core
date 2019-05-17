import {
  DisposableRef,
  IDisposable, Disposable,
  Uri,
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

export type IDocModelResolver = (uri: string | Uri) => Promise<IDocumentModel | null>;

export interface IDocumentModelManager extends IDisposable {
  open(uri: string | Uri): Promise<IDocumentModel | null>;
  close(uri: string | Uri): Promise<IDocumentModel | null>;
  update(uri: string | Uri, next: IDocumentModelMirror): Promise<IDocumentModel | null>;
  search(uri: string | Uri): Promise<IDocumentModel | null>;
  registerDocModelProvider(provider: IDocumentModelProvider): IDisposable;

  // TODO: more functions
}

export class DocumentModel extends DisposableRef<DocumentModel> implements IDocumentModel {
  private _uri: Uri;
  private _eol: string;
  private _lines: string[];
  private _encoding: string;
  private _language: string;

  constructor(uri: string | Uri, eol?: string, lines?: string[], encoding?: string, language?: string) {
    super();
    this._uri = Uri.parse(uri.toString());
    this._eol = eol || '\n';
    this._lines = lines || [''];
    this._encoding = encoding || 'utf-8';
    this._language = language || 'plaintext';

    this.addDispose({
      dispose: () => {
        // @ts-ignore
        this._uri = null;
        this._lines = [];
        this._eol = '';
        this._encoding = '';
        this._language = '';
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
    mirror.uri && (this._uri = Uri.parse(mirror.uri));
    mirror.lines && (this._lines = mirror.lines);
    mirror.eol && (this._eol = mirror.eol);
    mirror.encoding && (this._encoding = mirror.encoding);
    mirror.language && (this._language = mirror.language);
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
  async open(uri: string | Uri): Promise<IDocumentModel | null> {
    if (!this._docModelProvider) {
      return null;
    }

    const doc = await this._docModelProvider.initialize(uri);

    if (doc) {
      this._modelMap.set(uri.toString(), doc);
      return doc;
    }

    return null;
  }

  // @override
  async close(uri: string | Uri): Promise<IDocumentModel | null> {
    const doc = this._modelMap.get(uri.toString());

    if (doc) {
      this._modelMap.delete(uri.toString());
      return doc;
    }

    return null;
  }

  // @override
  async update(uri: string | Uri, mirror: IDocumentModelMirror): Promise<IDocumentModel | null> {
    const doc = this._modelMap.get(uri.toString());

    if (doc) {
      doc.fromMirror(mirror);
      return doc;
    }

    return null;
  }

  // @override
  async search(uri: string | Uri): Promise<IDocumentModel | null> {
    const res = this._modelMap.get(uri.toString());
    return Promise.resolve(!!res ? res : null);
  }

  async created(event: IDocumentCreatedEvent) {
    return null;
  }

  async changed(event: IDocumentChangedEvent) {
    const { uri, mirror } = event;

    return this.update(uri, mirror);
  }

  async renamed(event: IDocumentRenamedEvent) {
    const { from, to } = event;

    return this.update(from, { uri: to.toString() });
  }

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
