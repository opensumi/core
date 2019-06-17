import {
  Injectable,
  Autowired,
} from '@ali/common-di';
import {
  Emitter,
} from '@ali/ide-core-common';
import { DocumentModel, DocumentModelManager, Version, VersionType, IDocumentChangedEvent } from '../common';
import { IDocumentModelMirror, IDocumentModelContentChange } from '../common/doc';
import {
  RemoteProvider,
  EmptyProvider,
} from './provider';

export class BrowserDocumentModel extends DocumentModel {
  protected _version: Version = Version.init(VersionType.browser);
  private _baseVersion: Version = Version.init(VersionType.raw);

  private _onChange = new Emitter<void>();
  public onChange = this._onChange.event;

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
        undefined,
        monacoUri,
      );
      model.onDidChangeContent((event) => {
        if (model && !model.isDisposed()) {
          const { changes } = event;
          this.applyChange(changes);
          this.version = Version.from(model.getAlternativeVersionId(), VersionType.browser);
          this._onChange.fire();
        }
      });
    }
    return model;
  }

  async update(content: string) {
    const model = this.toEditor();
    await super.update(content);
    model.setValue(content);
    this._onChange.fire();
  }

  protected _apply(change: IDocumentModelContentChange) {
    super._apply(change);
  }
}

@Injectable()
export class BrowserDocumentModelManager extends DocumentModelManager {
  @Autowired()
  remoteProvider: RemoteProvider;
  @Autowired()
  emptyProvider: EmptyProvider;

  constructor() {
    super();
    this.resgisterDocModelInitialize((mirror) => BrowserDocumentModel.fromMirror(mirror));
    this.registerDocModelContentProvider(this.remoteProvider);
    this.registerDocModelContentProvider(this.emptyProvider);
  }

  async changed(event: IDocumentChangedEvent) {
    const { mirror } = event;
    const doc = await super.changed(event) as BrowserDocumentModel;
    if (mirror.base) {
      doc.baseVersion = Version.from(mirror.base.id, mirror.base.type);
      doc.merged();
    }
    return doc;
  }
}
