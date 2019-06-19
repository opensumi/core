import {
  Injectable,
  Autowired,
} from '@ali/common-di';
import { URI } from '@ali/ide-core-common';

import {
  DocumentModel,
  DocumentModelManager,
  Version,
  VersionType,
} from '../common';
import { IDocumentModelMirror, IDocumentChangedEvent } from '../common/doc';
import { FileSystemProvider } from './provider';
import { callAsyncProvidersMethod } from '../common/function';
import {
  INodeDocumentService,
} from '../common';
import { RPCService } from '@ali/ide-connection';

export class NodeVisualFileModel extends DocumentModel {
  protected _version: Version = Version.init(VersionType.raw);

  static fromMirror(mirror: IDocumentModelMirror) {
    return new NodeVisualFileModel(
      mirror.uri,
      mirror.eol,
      mirror.lines,
      mirror.encoding,
      mirror.language,
    );
  }

  async update(content: string) {
    /**
     * 当内容不一致的时候，说明这个变动来自于本地文件修改而不是用户保存，
     * 这个时候更新一下版本号。
     *
     * TODO: 比对内容过于消耗性能，需要本地计算 md5，使用 md5 来比对。
     */
    if (content !== this.getText()) {
      this._version = Version.next(this._version);
      await super.update(content);
    }
  }

  async rawUpdate(content: string) {
    await super.update(content);
  }

  toEditor() {
    return null;
  }

  toMirror() {
    const mirror: IDocumentModelMirror = super.toMirror();
    mirror.base = this._version.toJSON();
    return mirror;
  }
}

@Injectable()
export class NodeVisualFileModelManager extends DocumentModelManager {
  @Autowired()
  protected fileSystemProvider: FileSystemProvider;

  private _client: any;

  constructor() {
    super();
    this.registerDocModelContentProvider(this.fileSystemProvider);
    this.resgisterDocModelInitialize((mirror) => NodeVisualFileModel.fromMirror(mirror));
  }

  setClient(client) {
    this._client = client;
  }

  /**
   * 用户保存代码的时候，不需要更新版本。
   * 这个时候应该视作来自同一个基版本。
   *
   * @param uri
   * @param content
   */
  async persist(mirror: IDocumentModelMirror) {
    const doc = await this.resolve(mirror.uri) as NodeVisualFileModel;
    if (doc) {
      /**
       * 提前更新这个文本内容，当 watch 回来的时候可以知道这不是一个来自本地文件的修改。
       */
      await doc.rawUpdate(mirror.lines.join(mirror.eol));
      const providers = Array.from(this._docModelContentProviders.values());
      await callAsyncProvidersMethod(providers, 'persist', doc.toMirror());
      return doc;
    }
    return null;
  }

  async changed(event: IDocumentChangedEvent) {
    const { uri, mirror } = event;
    const doc = await this.search(uri);
    const content = mirror.lines.join(mirror.eol);

    if (doc && (doc.getText() !== content)) {
      doc.version = Version.next(doc.version);
      this._client.change({
        ...mirror,
        base: doc.version,
      });
    }

    return super.changed(event);
  }
}

@Injectable()
export class NodeDocumentService extends RPCService implements INodeDocumentService {
  @Autowired()
  private provider: FileSystemProvider;
  @Autowired()
  private manager: NodeVisualFileModelManager;

  constructor() {
    super();
    this.manager.setClient({
      change: (e) => {
        if (this.rpcClient) {
          this.rpcClient.forEach((client) => {
            client.updateContent(e);
          });
        }
      },
    });
  }

  async resolveContent(uri: URI) {
    const doc = await this.manager.resolve(uri);
    if (doc) {
      return doc.toMirror();
    }
    return null;
  }

  async saveContent(mirror: IDocumentModelMirror, override: boolean = false): Promise<IDocumentModelMirror | null> {
    const { base, uri } = mirror;
    const doc = await this.manager.search(uri);

    if (!doc && !base) {
      // 当这个 doc 不存在的时候，我们直接落到文件,
      // TODO: 这个逻辑可能需要一些调整。
      const res = await this.manager.persist(mirror);
      if (res) {
        return res.toMirror();
      }
    }

    if (doc && base) {
      if (Version.equal(doc.version, base)) {
        const res = await this.manager.persist(mirror);
        if (res) {
          return res.toMirror();
        }
      } else if (override) {
        // 用户确认合并操作之后，
        // 本地的 version 的 id 永远会更大。
        const nextBase = Version.from(doc.version.id, doc.version.type);
        const res = await this.manager.persist(mirror);
        if (res) {
          res.version = nextBase;
          return res.toMirror();
        }
      } else {
        return doc.toMirror();
      }
    }

    return null;
  }

  async watch(uri: string): Promise<number> {
    return this.provider.watch(uri);
  }

  async unwatch(id: number) {
    return this.provider.unwatch(id);
  }
}
