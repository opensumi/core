import { DocumentModel, DocumentModelManager } from '../common';
import { IDocumentModelMirror } from '../common/doc';

export class BrowserDocumentModel extends DocumentModel {
  static fromMirror(mirror: IDocumentModelMirror) {
    return new BrowserDocumentModel(
      mirror.uri,
      mirror.eol,
      mirror.lines,
      mirror.encoding,
      mirror.language,
    );
  }

  toEditor() {
    const model = monaco.editor.createModel(
      this.lines.join(this.eol),
      this.language,
    );
    return model;
  }
}

export class BrowserDocumentModelManager extends DocumentModelManager {
  constructor() {
    super();
    this.resgisterDocModelInitialize((mirror) => BrowserDocumentModel.fromMirror(mirror));
  }
}
