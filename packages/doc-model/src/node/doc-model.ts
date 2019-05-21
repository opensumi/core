import { DocumentModel } from '../common';
import { IDocumentModelMirror } from '../common/doc';

export class NodeDocumentModel extends DocumentModel {
  static fromMirror(mirror: IDocumentModelMirror) {
    return new NodeDocumentModel(
      mirror.uri,
      mirror.eol,
      mirror.lines,
      mirror.encoding,
      mirror.language,
    )
  }

  toEditor() {
    return null;
  }
}

