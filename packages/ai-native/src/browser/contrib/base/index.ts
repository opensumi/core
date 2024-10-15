import { Injector, Optional } from '@opensumi/di';
import { CancellationTokenSource, Disposable, IDisposable, Schemes } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { URI } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { IEditorContribution } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';

export abstract class BaseAIMonacoContribHandler extends Disposable {
  protected allowAnyScheme: boolean = false;
  protected allowedSchemes: string[] = [Schemes.file];

  sessionDisposable = new Disposable();

  monacoEditor: ICodeEditor | undefined;

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

  mountEditor(editor: ICodeEditor) {
    this.monacoEditor = editor;
    return {
      dispose: () => {
        this.monacoEditor = undefined;
      },
    };
  }
}

export abstract class BaseAIMonacoEditorController extends Disposable implements IEditorContribution {
  static ID: string;
  static get(editor: ICodeEditor): BaseAIMonacoEditorController | null {
    return editor.getContribution<BaseAIMonacoEditorController>(BaseAIMonacoEditorController.ID);
  }

  protected cancellationTokenSource = new CancellationTokenSource();

  public get token() {
    return this.cancellationTokenSource.token;
  }

  public cancelToken() {
    this.cancellationTokenSource.cancel();
    this.cancellationTokenSource = new CancellationTokenSource();
  }

  public featureDisposable = new Disposable();

  protected allowedSchemes: string[] = [Schemes.file, Schemes.notebookCell];

  constructor(
    @Optional() protected readonly injector: Injector,
    @Optional() protected readonly monacoEditor: ICodeEditor,
  ) {
    super();

    const contribDisposable: Disposable = new Disposable();
    let isMounted = false;

    this.addDispose(
      this.monacoEditor.onDidChangeModel(({ newModelUrl }) => {
        if (!newModelUrl) {
          return;
        }

        const shouldMount = this.allowedSchemes.includes(newModelUrl.scheme);
        if (shouldMount !== isMounted) {
          isMounted = !!shouldMount;
          if (isMounted) {
            contribDisposable.addDispose(this.mount());
          } else {
            contribDisposable.dispose();
          }
        }
      }),
    );

    const model = monacoEditor.getModel();

    if (model && this.allowedSchemes.includes(model.uri.scheme)) {
      isMounted = true;
      contribDisposable.addDispose(this.mount());
    }

    this.addDispose(contribDisposable);
  }

  abstract mount(): IDisposable;
}
