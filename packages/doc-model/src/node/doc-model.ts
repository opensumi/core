import {
  Injectable,
  Autowired,
} from '@ali/common-di';
import { URI } from '@ali/ide-core-common';

import {
  INodeDocumentService,
  DocumentModel,
  DocumentModelManager,
} from '../common';
import { IDocumentModelMirror } from '../common/doc';
import { FileSystemProvider } from './provider';

export class NodeDocumentModel extends DocumentModel {
  static fromMirror(mirror: IDocumentModelMirror) {
    return new NodeDocumentModel(
      mirror.uri,
      mirror.eol,
      mirror.lines,
      mirror.encoding,
      mirror.language,
    );
  }

  toEditor() {
    return null;
  }
}

@Injectable()
export class NodeDocumentModelManager extends DocumentModelManager {
  @Autowired()
  protected fileSystemProvider: FileSystemProvider;

  constructor() {
    super();
    this.registerDocModelContentProvider(this.fileSystemProvider);
    this.resgisterDocModelInitialize((mirror) => NodeDocumentModel.fromMirror(mirror));
  }
}

@Injectable()
export class NodeDocumentService implements INodeDocumentService {
  @Autowired()
  private docModelManager: NodeDocumentModelManager;

  async resolveContent(uri: URI) {
    const doc = await this.docModelManager.open(uri);
    if (doc) {
      return doc.toMirror();
    }
    return null;
  }
}
