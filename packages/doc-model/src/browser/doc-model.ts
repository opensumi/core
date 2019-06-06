import {
  Injectable,
  Inject,
} from '@ali/common-di';
import { DocumentModel, DocumentModelManager, Version, VersionType } from '../common';
import { IDocumentModelMirror, IDocumentModelContentChange } from '../common/doc';
import {
  servicePath,
} from '../common';
import {
  RemoteProvider,
  EmptyProvider,
} from './provider';

export class BrowserDocumentModel extends DocumentModel {
  protected _version: Version = Version.init(VersionType.browser);
  private _baseVersion: Version = Version.init(VersionType.raw);

  static fromMirror(mirror: IDocumentModelMirror) {
    const model = new BrowserDocumentModel(
      mirror.uri,
      mirror.eol,
      mirror.lines,
      mirror.encoding,
      mirror.language,
    );

    if (mirror.base) {
      model.baseVersion = Version.from(mirror.base.id, mirror.base.type);
    }

    return model;
  }

  get baseVersion() {
    return this._baseVersion;
  }

  set baseVersion(v: Version) {
    this._baseVersion = v;
  }

  get dirty() {
    return (this._version === this._baseVersion);
  }

  merged() {
    this._baseVersion = this._version;
  }

  toEditor() {
    const monacoUri = monaco.Uri.parse(this.uri.toString());
    let model = monaco.editor.getModel(monacoUri);
    if (!model) {
      model = monaco.editor.createModel(
        this.lines.join(this.eol),
        this.language,
        monacoUri,
      );
      model.onDidChangeContent((event) => {
        const { changes } = event;
        this.applyChange(changes);

        if (model && !model.isDisposed()) {
          this.version = Version.from(model.getAlternativeVersionId(), VersionType.browser);
        }
      });
    }
    return model;
  }

  protected _apply(change: IDocumentModelContentChange) {
    super._apply(change);
  }
}

@Injectable()
export class BrowserDocumentModelManager extends DocumentModelManager {
  constructor(
    @Inject(servicePath) protected readonly docService: any,
  ) {
    super();
    this.resgisterDocModelInitialize((mirror) => BrowserDocumentModel.fromMirror(mirror));
    this.registerDocModelContentProvider(new RemoteProvider(this.docService));
    this.registerDocModelContentProvider(new EmptyProvider(this.docService));
  }
}
