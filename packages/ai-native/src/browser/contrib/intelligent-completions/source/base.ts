import { Autowired, Injectable, Optional } from '@opensumi/di';
import {
  CancellationTokenSource,
  Disposable,
  IntelligentCompletionsRegistryToken,
  MaybePromise,
} from '@opensumi/ide-core-common';
import { ICodeEditor, IPosition } from '@opensumi/ide-monaco';
import { disposableObservableValue, transaction } from '@opensumi/monaco-editor-core/esm/vs/base/common/observable';

import { ICodeEdit, ICodeEditsContextBean, ICodeEditsResult } from '../index';
import { IntelligentCompletionsRegistry } from '../intelligent-completions.feature.registry';

@Injectable({ multiple: true })
export abstract class BaseCodeEditsSource extends Disposable {
  @Autowired(IntelligentCompletionsRegistryToken)
  private readonly intelligentCompletionsRegistry: IntelligentCompletionsRegistry;

  protected abstract doTrigger(...args: any[]): MaybePromise<void>;

  constructor(@Optional() protected readonly monacoEditor: ICodeEditor) {
    super();
  }

  protected cancellationTokenSource = new CancellationTokenSource();

  protected get model() {
    return this.monacoEditor.getModel();
  }

  protected get token() {
    return this.cancellationTokenSource.token;
  }

  public cancelToken() {
    this.cancellationTokenSource.cancel();
    this.cancellationTokenSource = new CancellationTokenSource();
  }

  public readonly codeEditsResult = disposableObservableValue<CodeEditsResultValue | undefined>(
    'codeEditsResult',
    undefined,
  );

  protected async launchProvider(editor: ICodeEditor, position: IPosition, bean: ICodeEditsContextBean): Promise<void> {
    const provider = this.intelligentCompletionsRegistry.getCodeEditsProvider();
    if (provider) {
      const result = await provider(editor, position, bean, this.token);

      if (result) {
        const codeEditsResultValue = new CodeEditsResultValue(result);

        transaction((tx) => {
          this.codeEditsResult.set(codeEditsResultValue, tx);
        });
      }
    }
  }
}

export class CodeEditsResultValue extends Disposable {
  constructor(private raw: ICodeEditsResult) {
    super();
  }

  public get items(): ICodeEdit[] {
    return this.raw.items;
  }
}
