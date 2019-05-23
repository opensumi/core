import {
  Injectable,
  Inject,
} from '@ali/common-di';
import { DocumentModel, DocumentModelManager } from '../common';
import { IDocumentModelMirror } from '../common/doc';
import {
  servicePath,
} from '../common';

export class BrowserDocumentModel extends DocumentModel {

  private _model: monaco.editor.ITextModel;

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
    if (!this._model) {
      this._model = monaco.editor.createModel(
        this.lines.join(this.eol),
        this.language,
        monaco.Uri.parse(this.uri.toString()),
      );
    }
    return this._model;
  }
}

@Injectable()
export class BrowserDocumentModelManager extends DocumentModelManager {
  constructor(
    @Inject(servicePath) protected readonly docService: any,
  ) {
    super();
    this.resgisterDocModelInitialize((mirror) => BrowserDocumentModel.fromMirror(mirror));
  }
}
