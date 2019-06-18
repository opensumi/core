import {
  Injectable,
  Autowired,
} from '@ali/common-di';
import {
  Emitter, URI, IEventBus,
} from '@ali/ide-core-common';
import { DocumentModel, DocumentModelManager, Version, VersionType, IDocumentChangedEvent, IVersion } from '../common';
import { IDocumentModelMirror, IDocumentModelContentChange } from '../common/doc';
import {
  RemoteProvider,
  EmptyProvider,
} from './provider';
import {
  callAsyncProvidersMethod,
} from '../common/function';
import { DocModelContentChangedEvent } from './event';

export class BrowserDocumentModel extends DocumentModel {
  protected _version: Version = Version.init(VersionType.browser);
  private _baseVersion: Version = Version.init(VersionType.raw);

  private _onContentChange = new Emitter<IDocumentModelContentChange[]>();
  public onContentChange = this._onContentChange.event;

  private _onMerged = new Emitter<void>();
  public onMerged = this._onMerged.event;

  static fromMirror(mirror: IDocumentModelMirror) {
    const model = new BrowserDocumentModel(
      mirror.uri,
      mirror.eol,
      mirror.lines,
      mirror.encoding,
      mirror.language,
    );

    if (mirror.base) {
      model.merged(Version.from(mirror.base.id, mirror.base.type));
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
    return !Version.equal(this._version, this._baseVersion);
  }

  merged(version: Version) {
    this._baseVersion = this._version = version;
    this._onMerged.fire();
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
          if (
            Version.same(this.baseVersion, this.version) &&
            !Version.equal(this.baseVersion, this.version)) {
            this.merged(this.baseVersion);
          } else {
            this.version = Version.from(model.getAlternativeVersionId(), VersionType.browser);
          }
          this._onContentChange.fire(changes);
        }
      });
    }
    return model;
  }

  async update(content: string) {
    const model = this.toEditor();
    await super.update(content);
    model.pushStackElement();
    model.pushEditOperations([], [{
      range: model.getFullModelRange(),
      text: content,
    }], () => []);
  }

  protected _apply(change: IDocumentModelContentChange) {
    super._apply(change);
  }

  toMirror() {
    const mirror = super.toMirror();
    return {
      ...mirror,
      base: this._baseVersion,
    };
  }
}

@Injectable()
export class BrowserDocumentModelManager extends DocumentModelManager {
  @Autowired()
  remoteProvider: RemoteProvider;
  @Autowired()
  emptyProvider: EmptyProvider;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  constructor() {
    super();
    this.resgisterDocModelInitialize((mirror) => BrowserDocumentModel.fromMirror(mirror));
    this.registerDocModelContentProvider(this.remoteProvider);
    this.registerDocModelContentProvider(this.emptyProvider);
  }

  async createModel(uri: URI): Promise<BrowserDocumentModel | null> {
    const doc = await super.createModel(uri) as BrowserDocumentModel;
    if (doc) {
      doc.onContentChange((changes) => {
        this.eventBus.fire(new DocModelContentChangedEvent({
          uri: doc.uri,
          changes,
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
    }
    return doc;
  }

  async changed(event: IDocumentChangedEvent) {
    const { mirror } = event;
    const doc = await this.search(mirror.uri) as BrowserDocumentModel;

    if (!doc) {
      return null;
    }

    if (!doc.dirty) {
      if (mirror.base) {
        doc.baseVersion = Version.from(mirror.base.id, mirror.base.type);
      }
      return super.changed(event);
    }

    return doc;
  }

  async save(uri: string | URI, override: boolean = false) {
    const doc = await this.search(uri) as BrowserDocumentModel;

    if (!doc) {
      throw new Error(`doc ${uri.toString()} not found`);
    }

    const providers = Array.from(this._docModelContentProviders.values());
    const mirror = await callAsyncProvidersMethod<IDocumentModelMirror>(providers, 'persist', doc.toMirror(), override);

    if (override) {
      setTimeout(() => {
        if (mirror && mirror.base) {
          doc.merged(Version.from(mirror.base.id, mirror.base.type));
        }
      }, 0);
      return true;
    }

    if (mirror && mirror.base) {
      if (Version.equal(mirror.base, doc.baseVersion)) {
        // 这个时候说明本地的 node version 和当前的 base version 是一个基版本，
        // 可以认为是保存成功了。
        doc.merged(Version.from(mirror.base.id, mirror.base.type));
        return true;
      } else {
        // 当基版本号不一致的时候说明本地接收了一次本地文件的修改，
        // 我们尝试开始一次 merge 操作。
        // TODO: 目前先强制 override
        const override = true;
        if (override) {
          const res = this.save(uri, override);
        }
      }
    }

    return false;
  }
}
