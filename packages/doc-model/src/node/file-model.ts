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

  async persist(uri: string | URI, content: string) {
    const doc = await this.update(uri, content);
    if (doc) {
      // update version
      doc.version = Version.next(doc.version);

      const providers = Array.from(this._docModelContentProviders.values());
      await callAsyncProvidersMethod(providers, 'persist', doc.toMirror());
      return doc;
    }
    return null;
  }
}
