import {
  DisposableRef,
  IDisposable, Disposable,
  URI,
} from '@ali/ide-core-common';
import {
  IDocumentModel,
  IDocumentModelMirror,
  IDocumentCreatedEvent,
  IDocumentChangedEvent,
  IDocumentRenamedEvent,
  IDocumentRemovedEvent,
  IDocumentModeContentProvider,
  IDocumentModelContentChange,
  IRange,
} from './doc';
import {
  callAsyncProvidersMethod,
} from './function';
import { IVersion } from './version';

export * from './const';
export * from './version';
export * from './doc';

export interface INodeDocumentService {
  resolveContent(uri: string | URI): Promise<IDocumentModelMirror| null>;
  saveContent(mirror: IDocumentModelMirror, override?: boolean): Promise<IDocumentModelMirror | null>;
  watch(uri: string): Promise<number>;
  unwatch(id: number): Promise<void>;
}

export interface IDocumentModelManager extends IDisposable {
  resolve(uri: string | URI): Promise<IDocumentModel | null>;
  update(uri: string | URI, content: string): Promise<IDocumentModel | null>;
  search(uri: string | URI): Promise<IDocumentModel | null>;
  resgisterDocModelInitialize(initialize: (mirror: IDocumentModelMirror) => IDocumentModel): void;
  registerDocModelContentProvider(provider: IDocumentModeContentProvider): IDisposable;

  // TODO: more functions
}

export class DocumentModel extends DisposableRef<DocumentModel> implements IDocumentModel {
  /**
   * @override
   *
   * @param mirror
   */
  static fromMirror(mirror: IDocumentModelMirror) {
    return new DocumentModel(
      mirror.uri,
      mirror.eol,
      mirror.lines,
      mirror.encoding,
      mirror.language,
    );
  }

  protected _uri: URI;
  protected _eol: string;
  protected _lines: string[];
  protected _encoding: string;
  protected _language: string;
  protected _version: IVersion;
  protected _dirty: boolean;

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
      },
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

  get version() {
    return this._version;
  }

  set version(v: IVersion) {
    this._version = v;
  }

  get dirty() {
    return this._dirty;
  }

  protected _apply(change: IDocumentModelContentChange) {
    const { rangeLength, rangeOffset, text } = change;
    const textString = this.getText();
    const nextString = textString.slice(0, rangeOffset) + text + textString.slice(rangeOffset + rangeLength);
    this._lines = nextString.split(this._eol);
  }

  applyChange(changes: IDocumentModelContentChange[]) {
    changes.forEach((change) => {
      this._apply(change);
    });
  }

  getText(range?: IRange) {
    if (!range) {
      return this.lines.join(this._eol);
    }
    let result = '';
    const { startLineNumber, startColumn, endLineNumber, endColumn } = range;

    if (startLineNumber === endLineNumber) {
      result = this.lines[startLineNumber];
      if (!result) {
        return '';
      } else {
        return result.substring(startColumn, endColumn);
      }
    } else {
      for (let index = startLineNumber; index < (endLineNumber + 1); index++) {
        const lineText = this.lines[index];
        if (!lineText) {
          result += '';
        } else if (index === startLineNumber) {
          result += lineText.substring(startColumn) + '\n';
        } else if (index === endLineNumber) {
          result += lineText.substring(0, endColumn);
        } else {
          result += lineText + '\n';
        }
      }
    }
    return result;
  }

  /**
   * @override
   */
  toEditor() {
    return null as any;
  }

  /**
   * @override
   *
   * @param content
   */
  async update(content: string) {
    this._lines = content.split(this._eol);
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
}

export class DocumentModelManager extends Disposable implements IDocumentModelManager {
  protected _modelMap: Map<string, IDocumentModel>;
  protected _docModelInitialize: (mirror: IDocumentModelMirror) => IDocumentModel;
  protected _docModelContentProviders: Set<IDocumentModeContentProvider>;

  constructor() {
    super();
    this._modelMap = new Map();
    this.resgisterDocModelInitialize((mirror) => DocumentModel.fromMirror(mirror));
    this._docModelContentProviders = new Set();
  }

  private _delete(uri: string | URI): IDocumentModel | null {
    const doc = this._modelMap.get(uri.toString());

    if (doc) {
      this._modelMap.delete(uri.toString());
      return doc;
    }

    return null;
  }

  resgisterDocModelInitialize(initialize: (mirror: IDocumentModelMirror) => IDocumentModel) {
    this._docModelInitialize = initialize;
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
  async resolve(uriString: string | URI): Promise<IDocumentModel | null> {
    if (this._docModelContentProviders.size === 0) {
      return null;
    }

    const uri = new URI(uriString.toString());

    const model = await this.search(uri);

    if (model) {
      return model;
    }

    return this.createModel(uri);

  }

  async createModel(uri: URI): Promise<IDocumentModel | null> {

    const providers = Array.from(this._docModelContentProviders.values());

    const mirror = await callAsyncProvidersMethod<IDocumentModelMirror>(providers, 'build', uri);
    if (mirror) {
      const doc = this._docModelInitialize(mirror);
      const id = await callAsyncProvidersMethod<number>(providers, 'watch', uri);

      this._modelMap.set(uri.toString(), doc);
      doc.onDispose(() => {
        if (id) {
          callAsyncProvidersMethod(providers, 'unwatch', id);
        }
      });
      return doc;
    }

    return null;
  }

  /**
   * @override
   */
  async update(uri: string | URI, content: string): Promise<IDocumentModel | null> {
    const doc = this._modelMap.get(uri.toString());

    if (doc) {
      doc.update(content);
      return doc;
    }

    return null;
  }

  /**
   * @override
   */
  async search(uri: string | URI): Promise<IDocumentModel | null> {
    const res = this._modelMap.get(uri.toString());
    return Promise.resolve(!!res ? res : null);
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
    const { uri, mirror } = event;
    const lines = mirror.lines || [];
    const eol = mirror.eol || '\n';
    return this.update(uri, lines.join(eol));
  }

  /**
   * @override
   */
  async renamed(event: IDocumentRenamedEvent) {
    const { from, to } = event;
    this._delete(from);
    return this.resolve(to);
  }

  /**
   * @override
   */
  async removed(event: IDocumentRemovedEvent) {
    const { uri } = event;
    const doc = await this.search(uri);

    if (doc) {
      this._delete(uri);
    }
  }
}
