import { DisposableRef, URI, Emitter as EventEmitter } from '@ali/ide-core-common';
import {
  IDocumentModelMirror,
  Version,
  IDocumentModelContentChange,
  IMonacoRange,
  IDocumentModelRange,
} from '../common';
import { VersionType, IDocumentModel } from '../common';

export function monacoRange2DocumentModelRange(range: IMonacoRange): IDocumentModelRange {
  return {
    startRow: range.startLineNumber - 1,
    startCol: range.startColumn - 1,
    endRow: range.endLineNumber - 1,
    endCol: range.endColumn - 1,
  };
}

export function documentModelRange2MonacoRange(range: IDocumentModelRange): IMonacoRange {
  return {
    startLineNumber: range.startRow + 1,
    startColumn: range.startCol + 1,
    endLineNumber: range.endRow + 1,
    endColumn: range.endCol + 1,
  };
}

export class DocumentModel extends DisposableRef<DocumentModel> implements IDocumentModel {
  /**
   * @override
   * @param mirror
   */
  static fromMirror(mirror: IDocumentModelMirror) {
    return new DocumentModel(
      mirror.uri,
      mirror.eol,
      mirror.lines,
      mirror.encoding,
      mirror.language,
      Version.from(mirror.base.id, mirror.base.type),
    );
  }

  protected _onMerged = new EventEmitter<Version>();
  protected _onContentChanged = new EventEmitter<IDocumentModelMirror>();

  public onMerged = this._onMerged.event;
  public onContentChanged = this._onContentChanged.event;

  protected _uri: URI;
  protected _eol: string;
  protected _lines: string[];
  protected _encoding: string;
  protected _language: string;
  protected _version: Version;
  protected _baseVersion: Version;

  constructor(uri?: string | URI, eol?: string, lines?: string[], encoding?: string, language?: string, version?: Version) {
    super();
    // @ts-ignore
    this._uri = uri ? new URI(uri.toString()) : null;
    this._eol = eol || '\n';
    this._lines = lines || [''];
    this._encoding = encoding || 'utf-8';
    this._language = language || 'plaintext';
    this._baseVersion = this._version = version || Version.init(VersionType.browser);

    this.addDispose({
      dispose: () => {
        // @ts-ignore
        this._uri = null;
        this._lines = [];
        this._eol = '';
        this._encoding = '';
        this._language = '';
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

  get baseVersion() {
    return this._baseVersion;
  }

  /**
   * 当基版本和当前版本不一致时为 dirty，
   * 当基版本为 browser 类型的时候，说明这个文件在本地空间不存在，也为 dirty 类型
   */
  get dirty() {
    return (this.baseVersion.type === VersionType.browser) ||
      !Version.equal(this.baseVersion, this.version);
  }

  forward(version: Version) {
    this._version = version;
  }

  merge(version: Version) {
    this._baseVersion = this._version = version;
    this._onMerged.fire(version);
  }

  rebase(version: Version) {
    this._baseVersion = version;
  }

  virtual() {
    const model = this.toEditor();
    if (model) {
      const version = Version.from(model.getAlternativeVersionId(), VersionType.browser);
      this.merge(version);
    }
  }

  protected _apply(change: IDocumentModelContentChange) {
    const { rangeLength, rangeOffset, text } = change;
    const textString = this.getText();
    const nextString = textString.slice(0, rangeOffset) + text + textString.slice(rangeOffset + rangeLength);
    this._lines = nextString.split(this._eol);
  }

  applyChanges(changes: IDocumentModelContentChange[]) {
    changes.forEach((change) => {
      this._apply(change);
    });
    this._onContentChanged.fire(this.toMirror());
  }

  getText(range?: IMonacoRange) {
    if (!range) {
      return this.lines.join(this._eol);
    }
    let result = '';
    const { startRow, startCol, endRow, endCol }: IDocumentModelRange = monacoRange2DocumentModelRange(range);

    if (startRow === endRow) {
      result = this.lines[startRow];
      if (result && typeof (result) === 'string') {
        return result.substring(startCol, endCol);
      } else {
        return '';
      }
    } else {
      for (let index = startRow; index < (endRow + 1); index++) {
        const lineText = this._lines[index];
        if (index === startRow) {
          result += lineText.substring(startCol) + '\n';
        } else if (index === endRow) {
          result += lineText.substring(0, endCol);
        } else {
          result += lineText + '\n';
        }
      }
    }
    return result;
  }

  updateContent(content: string) {
    this._lines = content.split(this._eol);
    this._onContentChanged.fire(this.toMirror());

    const model = this.toEditor();
    model.pushStackElement();
    model.pushEditOperations([], [{
      range: model.getFullModelRange(),
      text: content,
    }], () => []);
  }

  toEditor() {
    let monacoUri: monaco.Uri;
    try {
      monacoUri = monaco.Uri.parse(this.uri.toString());
    } catch {
      throw new Error('Can not find monaco or monaco is not ready.');
    }
    let model = monaco.editor.getModel(monacoUri);
    if (!model) {
      model = monaco.editor.createModel(
        this.lines.join(this.eol),
        undefined,
        monacoUri,
      );
      if (!this.language) {
        this._language = (model as any).getLanguageIdentifier().language;
      }
      model.onDidChangeContent((event) => {
        if (model && !model.isDisposed()) {
          const { changes } = event;
          if (
            Version.same(this.baseVersion, this.version) &&
            !Version.equal(this.baseVersion, this.version)) {
            this.merge(this.baseVersion);
          } else {
            this.forward(Version.from(model.getAlternativeVersionId(), VersionType.browser));
          }
          /**
           * applyChanges 会触发一次内容修改的事件，
           * 所以必须在版本号同步更新完成之后来进行这个操作。
           */
          this.applyChanges(changes);
        }
      });
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
      base: this.baseVersion,
    };
  }
}
