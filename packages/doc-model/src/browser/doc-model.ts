import { DisposableRef, URI, Emitter as EventEmitter } from '@ali/ide-core-common';
import {
  IDocumentModelMirror,
  Version,
  IDocumentModelContentChange,
  IMonacoRange,
  IDocumentModelRange,
  IDocumentVersionChangedEvent,
  IDocumentContentChangedEvent,
  IDocumentLanguageChangedEvent,
} from '../common';
import {
  applyChange,
} from '../common/utils';
import {
  ChangesStack,
} from './changes-stack';
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

  protected _onMerged = new EventEmitter<IDocumentVersionChangedEvent>();
  protected _onContentChanged = new EventEmitter<IDocumentContentChangedEvent>();
  protected _onLanguageChanged = new EventEmitter<IDocumentLanguageChangedEvent>();

  public onMerged = this._onMerged.event;
  public onContentChanged = this._onContentChanged.event;
  public onLanguageChanged = this._onLanguageChanged.event;

  protected _uri: URI;
  protected _eol: string;
  protected _lines: string[];
  protected _encoding: string;
  protected _language: string;
  protected _version: Version;
  protected _baseVersion: Version;
  protected _changesStack: ChangesStack;

  constructor(uri?: string | URI, eol?: string, lines?: string[], encoding?: string, language?: string, version?: Version) {
    super();
    // @ts-ignore
    this._uri = uri ? new URI(uri.toString()) : null;
    this._eol = eol || '\n';
    this._lines = lines || [''];
    this._encoding = encoding || 'utf-8';
    this._language = language || '';
    this._baseVersion = this._version = version || Version.init(VersionType.browser);
    this._changesStack = new ChangesStack();

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

  set language(languageId: string) {
    const from = this._language;
    this._language = languageId;
    this._onLanguageChanged.fire({
      from,
      to: languageId,
    });
  }

  get version() {
    return this._version;
  }

  get baseVersion() {
    return this._baseVersion;
  }

  get changesStack() {
    return this._changesStack.value;
  }

  /**
   * 当基版本和当前版本不一致时为 dirty，
   * 当基版本为 browser 类型的时候，说明这个文件在本地空间不存在，也为 dirty 类型
   */
  get dirty() {
    return (this.baseVersion.type === VersionType.browser) ||
      (!Version.equal(this.baseVersion, this.version) && !this._changesStack.isClear);
  }

  forward(version: Version) {
    this._version = version;
  }

  merge(version: Version) {
    const from = this._version;
    this._baseVersion = this._version = version;
    this._changesStack.save();
    this._onMerged.fire({
      from,
      to: version,
    });
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
    const nextString = applyChange(this.getText(), change);
    this._lines = nextString.split(this._eol);
  }

  applyChanges(changes: monaco.editor.IModelContentChange[]) {
    changes.forEach((change) => {
      this._apply(change);
    });
    this._onContentChanged.fire({
      changes,
    });
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
    const model = this.toEditor();
    const change = {
      range: model.getFullModelRange(),
      text: content,
    };
    model.pushStackElement();
    model.pushEditOperations([], [change], () => []);
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
          const { changes, isUndoing, isRedoing } = event;

          /**
           * changes stack 要优选被处理，
           * 这样在判断状态的时候 isClear 才是正确反应下一个状态的值
           */
          if (isUndoing) {
            this._changesStack.undo(changes);
          }
          if (isRedoing) {
            this._changesStack.redo(changes);
          }

          /**
           * 这里有几种情况，
           * 当文件的 version 和 base 类型不同并且 change stack 为 clear 的时候，说明这个文件内容和基文件保持一致，这个时候只需要 merge 一下 version 就好了，
           * 当文件的 version 和 base 类型相同但是版本号不同，
           *  如果这个 type 是 raw，说明是一个非 dirty 状态的本地修改也只需要 merge 一下 version，
           *  如果这个 type 是 browser，说明是虚拟文件不需要 change stack 的参与，merge 一下即可
           */
          if (
            (!Version.same(this.baseVersion, this.version) && this._changesStack.isClear) ||
            (Version.same(this.baseVersion, this.version) && !Version.equal(this.baseVersion, this.version))
          ) {
            this.merge(this.baseVersion);
          } else {
            this.forward(Version.from(model.getAlternativeVersionId(), VersionType.browser));
            if (!isUndoing && !isRedoing) {
              this._changesStack.forward(changes);
            }
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

  toStatMirror() {
    return {
      uri: this._uri.toString(),
      eol: this.eol,
      encoding: this.encoding,
      language: this.language,
      base: this.baseVersion,
    };
  }
}
