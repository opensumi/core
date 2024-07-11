import { Disposable, IDisposable, Schemes } from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor/lib/browser';
import { URI } from '@opensumi/ide-monaco/lib/browser/monaco-api';

export abstract class IAIMonacoContribHandler extends Disposable {
  sessionDisposable = new Disposable();

  editor: IEditor | undefined;

  constructor() {
    super();
  }

  intercept(uri: URI) {
    if (uri.scheme !== Schemes.file) {
      return true;
    }

    return false;
  }

  abstract doContribute(): IDisposable;

  unload() {
    this.sessionDisposable.dispose();
    this.sessionDisposable = new Disposable();
  }

  load() {
    this.unload();
    this.sessionDisposable.addDispose(this.doContribute());
  }

  mountEditor(editor: IEditor) {
    this.editor = editor;
    return {
      dispose: () => {
        this.editor = undefined;
      },
    };
  }
}
