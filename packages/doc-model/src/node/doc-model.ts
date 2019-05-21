import { DocumentModel } from '../common';
import { IDocumentModelMirror } from '../common/doc';

export class NodeDocumentModel extends DocumentModel {
  static fromMirror(mirror: IDocumentModelMirror) {
    const docModel = new NodeDocumentModel();
    docModel.fromMirror(mirror);
    return docModel;
  }

  toEditor() {
    return null;
  }
}
