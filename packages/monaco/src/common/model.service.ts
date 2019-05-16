import {
  IDisposableRef, DisposableRef,
  IDisposable, Disposable,
  Uri,
} from '@ali/ide-core-common';

export interface IDocumentModelMirror {
  uri: string;
  lines: string[];
  eol: string;
  encoding: string;
  language: string;
}

export interface IDocumentModel extends IDisposableRef<IDocumentModel> {
  uri: Uri;
  lines: string[];
  eol: string;
  encoding: string;
  language: string;
  version: number;

  // 转化为 monaco 的内置 model 类型。
  toModel(): monaco.editor.IModel;
  // 可序列化的 pure object。
  toMirror(): IDocumentModelMirror;
  // 获取某一段的文字内容。
  getText(range: monaco.IRange): string;

  // TODO: more functions
}

export type IContentResolver = (uri: string | Uri) => Promise<IDocumentModelMirror | null>;

export interface IDocumentModelManager extends IDisposable {
  open(uri: string | Uri): Promise<IDocumentModel | null>;
  close(uri: string | Uri): Promise<IDocumentModel | null>;
  update(uri: string | Uri): Promise<IDocumentModel | null>;
  search(uri: string | Uri): IDocumentModel | null;
  registerContentResolverProvider(provider: IContentResolver): IDisposable;

  // TODO: more functions
}

export class DocumentModel extends DisposableRef implements IDocumentModel {
  private _uri: Uri;
  private _eol: string;
  private _lines: string[];
  private _encoding: string;
  private _language: string;
  private _version: number;
  private _last: number;

  constructor(uri: string | Uri, eol: string, lines: string[], encoding: string, language: string = 'plaintext') {
    super();
    this._uri = uri;
    this._eol = eol;
    this._lines = lines;
    this._encoding = encoding;
    this._language = language;
    this._version = 1;
    this._last = 1;

    this.addDispose({
      dispose: () => {
        this._uri = null;
        this._lines = [];
        this._eol = '';
        this._encoding = '';
        this._language = '';
        this._version = this._last = 0;
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

  get version() {
    return this._version;
  }

  toModel() {
    let model = monaco.editor.getModel(this._uri);

    if (!model) {
      model = monaco.editor.createModel(
        this.lines.join(this.eol), this.language, this.uri);
    }

    return model;
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

  getText(range: monaco.IRange) {
    // TODO
    return '';
  }
}

export class DocumentModelManager extends Disposable implements IDocumentModelManager {
  private _modelMap: Map<string, IDocumentModel>;
  private _contentResolver: IContentResolver;

  constructor() {
    super();
    this._modelMap = new Map();
    this._contentResolver = () => Promise.resolve(null);
  }

  registerContentResolverProvider(provider: IContentResolver) {
    this._contentResolver = provider;
  }

  async open(uri: string | Uri): Promise<IDocumentModel | null> {
    const mirror = await this._contentResolver(uri);

    if (mirror) {
      const doc = new DocumentModel(
        Uri.parse(mirror.uri),
        mirror.eol,
        mirror.lines,
        mirror.encoding,
        mirror.language,
      );

      this._modelMap.set(mirror.uri, doc);

      return doc;
    }

    return null;
  }

  async close(uri: string | Uri): Promise<IDocumentModel | null> {
    const doc = this._modelMap.get(uri.toString());

    if (doc) {
      this._modelMap.delete(uri.toString());
    }

    return null;
  }

  async update(uri: string | Uri): Promise<IDocumentModel | null> {
    // TODO

    return null;
  }

  search(uri: string | Uri): IDocumentModel | null {
    const res = this._modelMap.get(uri.toString());
    return !!res ? res : null;
  }
}
