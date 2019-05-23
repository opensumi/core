import {
  Injectable,
  Inject,
} from '@ali/common-di';
import { DocumentModel, DocumentModelManager } from '../common';
import { IDocumentModelMirror } from '../common/doc';
import {
  servicePath,
} from '../common';
import {
  RemoteProvider,
  EmptyProvider,
} from './provider';

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
    const monacoUri = monaco.Uri.parse(this.uri.toString());
    let model = monaco.editor.getModel(monacoUri);
    if (!model) {
      model = monaco.editor.createModel(
        this.lines.join(this.eol),
        this.language,
        monacoUri,
      );
      model.onDidChangeContent((event) => {
        const { changes } = event;
        this.applyChange(changes);
      });
    }
    return model;
  }
}

@Injectable()
export class BrowserDocumentModelManager extends DocumentModelManager {
  constructor(
    @Inject(servicePath) protected readonly docService: any,
  ) {
    super();
    this.resgisterDocModelInitialize((mirror) => BrowserDocumentModel.fromMirror(mirror));
    this.registerDocModelContentProvider(new RemoteProvider(this.docService));
    this.registerDocModelContentProvider(new EmptyProvider(this.docService));
  }
}
