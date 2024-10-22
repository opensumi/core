import { Autowired, INJECTOR_TOKEN, Injectable, Injector, Optional } from '@opensumi/di';
import {
  CancellationTokenSource,
  Disposable,
  IDisposable,
  IntelligentCompletionsRegistryToken,
  MaybePromise,
  uuid,
} from '@opensumi/ide-core-common';
import { ConstructorOf } from '@opensumi/ide-core-common';
import { ICodeEditor, IPosition } from '@opensumi/ide-monaco';
import { DisposableStore } from '@opensumi/monaco-editor-core/esm/vs/base/common/lifecycle';
import {
  autorunDelta,
  debouncedObservable,
  derived,
  disposableObservableValue,
  transaction,
} from '@opensumi/monaco-editor-core/esm/vs/base/common/observable';

import { ICodeEdit, ICodeEditsContextBean, ICodeEditsResult } from '../index';
import { IntelligentCompletionsRegistry } from '../intelligent-completions.feature.registry';

@Injectable({ multiple: true })
export abstract class BaseCodeEditsSource extends Disposable {
  @Autowired(IntelligentCompletionsRegistryToken)
  private readonly intelligentCompletionsRegistry: IntelligentCompletionsRegistry;

  protected abstract doTrigger(...args: any[]): MaybePromise<void>;

  public readonly codeEditsResult = disposableObservableValue<CodeEditsResultValue | undefined>(this, undefined);

  public abstract priority: number;
  public abstract mount(): IDisposable;

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

  protected resetCodeEditsResult = derived(this, () => {
    transaction((tx) => {
      this.codeEditsResult.set(undefined, tx);
    });
  });

  protected async launchProvider(editor: ICodeEditor, position: IPosition, bean: ICodeEditsContextBean): Promise<void> {
    const provider = this.intelligentCompletionsRegistry.getCodeEditsProvider();
    if (provider) {
      const result = await provider(editor, position, bean, this.token);

      if (result) {
        const codeEditsResultValue = new CodeEditsResultValue(result, this);

        transaction((tx) => {
          this.codeEditsResult.set(codeEditsResultValue, tx);
        });
      }
    }
  }
}

export class CodeEditsResultValue extends Disposable {
  public readonly uid = uuid(6);

  constructor(private readonly raw: ICodeEditsResult, private readonly source: BaseCodeEditsSource) {
    super();
  }

  public get items(): ICodeEdit[] {
    return this.raw.items;
  }

  public get priority(): number {
    return this.source.priority;
  }
}

@Injectable({ multiple: true })
export class CodeEditsSourceCollection extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  public readonly codeEditsResult = disposableObservableValue<CodeEditsResultValue | undefined>(this, undefined);

  constructor(
    private readonly constructorSources: ConstructorOf<BaseCodeEditsSource>[],
    private readonly monacoEditor: ICodeEditor,
  ) {
    super();
  }

  public mount() {
    const sources = this.constructorSources.map((source) => this.injector.get(source, [this.monacoEditor]));

    sources.forEach((source) => this.addDispose(source.mount()));

    const store = this.registerDispose(new DisposableStore());

    // 观察所有 source 的 codeEditsResult
    const observerCodeEditsResult = derived((reader) => ({
      codeEditsResults: new Map(sources.map((source) => [source, source.codeEditsResult.read(reader)])),
    }));

    this.addDispose(
      autorunDelta(
        // 这里需要做 debounce 0 处理，将多次连续的事务通知合并为一次
        debouncedObservable(observerCodeEditsResult, 0, store),
        ({ lastValue, newValue }) => {
          // 只拿最新的订阅值，如果 uid 相同，表示该值没有变化，就不用往下通知了
          const lastSources = sources.filter((source) => {
            const newValueResult = newValue?.codeEditsResults.get(source);
            const lastValueResult = lastValue?.codeEditsResults?.get(source);
            return newValueResult && (!lastValueResult || newValueResult.uid !== lastValueResult.uid);
          });

          let highestPriority = 0;
          let currentResult: CodeEditsResultValue | undefined;

          for (const source of lastSources) {
            const value = source.codeEditsResult.get();

            if (value && value.priority > highestPriority) {
              highestPriority = value.priority;
              currentResult = value;
            }
          }

          transaction((tx) => {
            // 只通知最高优先级的结果
            this.codeEditsResult.set(currentResult, tx);
          });
        },
      ),
    );
  }
}
