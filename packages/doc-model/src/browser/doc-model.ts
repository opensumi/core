import { URI } from '@ali/ide-core-common';
import { DocumentModel, DocumentModelManager } from '../common';
import { IDocumentModelMirror } from '../common/doc';

export class BrowserDocumentModel extends DocumentModel {
  static fromMirror(mirror: IDocumentModelMirror) {
    const docModel = new BrowserDocumentModel();
    docModel.fromMirror(mirror);
    return docModel;
  }

  toEditor() {
    const model = monaco.editor.createModel(this.uri.toString());
    return model;
  }
}

export class BrowserDocumentModelManager extends DocumentModelManager {
  async open(uri: string | URI) {
    if (!this._docModelProvider) {
      return null;
    }

    const mirror = await this._docModelProvider.build(uri);
    if (mirror) {
      const doc = BrowserDocumentModel.fromMirror(mirror);
      const { dispose } = this._docModelProvider.watch(uri);

      this._modelMap.set(uri.toString(), doc);
      doc.onDispose(() => dispose());
      return doc;
    }

    return null;
  }
}

