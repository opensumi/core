import { Disposable, IDisposable, Schemes } from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor/lib/browser';
import { URI } from '@opensumi/ide-monaco/lib/browser/monaco-api';

export abstract class IAIMonacoContribHandler extends Disposable {
  protected allowAnyScheme: boolean = false;
  protected allowedSchemes: string[] = [Schemes.file];

  sessionDisposable = new Disposable();

  editor: IEditor | undefined;

  constructor() {
    super();
  }

  shouldHandle(uri: URI) {
    if (this.allowAnyScheme) {
      return true;
    }

    if (this.allowedSchemes.includes(uri.scheme)) {
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
