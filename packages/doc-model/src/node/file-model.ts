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
import { IDocumentModelMirror } from '../common/doc';
import { FileSystemProvider } from './provider';
import { callAsyncProvidersMethod } from '../common/function';

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

  constructor() {
    super();
    this.registerDocModelContentProvider(this.fileSystemProvider);
    this.resgisterDocModelInitialize((mirror) => NodeVisualFileModel.fromMirror(mirror));
  }

  /**
   * 用户保存代码的时候，不需要更新版本。
   * 这个时候应该视作来自同一个基版本。
   *
   * @param uri
   * @param content
   */
  async persist(uri: string | URI, content: string) {
    const doc = await this.update(uri, content);
    if (doc) {
      const providers = Array.from(this._docModelContentProviders.values());
      await callAsyncProvidersMethod(providers, 'persist', doc.toMirror());
      return doc;
    }
    return null;
  }
}
