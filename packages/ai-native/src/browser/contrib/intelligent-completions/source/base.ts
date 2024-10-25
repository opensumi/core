import { Autowired, INJECTOR_TOKEN, Injectable, Injector, Optional } from '@opensumi/di';
import {
  AISerivceType,
  CodeEditsRT,
  ConstructorOf,
  Disposable,
  IAIReporter,
  IDisposable,
  MaybePromise,
  uuid,
} from '@opensumi/ide-core-common';
import { CancellationTokenSource, ICodeEditor } from '@opensumi/ide-monaco';
import {
  autorunDelta,
  debouncedObservable,
  derived,
  disposableObservableValue,
  observableValue,
  transaction,
} from '@opensumi/ide-monaco/lib/common/observable';
import { DisposableStore } from '@opensumi/monaco-editor-core/esm/vs/base/common/lifecycle';

import { ICodeEditsContextBean } from '../index';

export class CodeEditsContextBean extends Disposable {
  public readonly uid = uuid(6);

  constructor(private readonly raw: ICodeEditsContextBean, private readonly source: BaseCodeEditsSource) {
    super();
  }

  public get priority() {
    return this.source.priority;
  }

  public get bean() {
    return this.raw;
  }

  public get position() {
    return this.raw.position;
  }

  public get token() {
    return this.source.token;
  }

  public reporterStart() {
    return this.source.reporterStart();
  }

  public cancelToken() {
    return this.source.cancelToken();
  }

  public reporterEnd(data: CodeEditsRT) {
    return this.source.reporterEnd(data);
  }
}

@Injectable({ multiple: true })
export abstract class BaseCodeEditsSource extends Disposable {
  @Autowired(IAIReporter)
  private aiReporter: IAIReporter;

  private cancellationTokenSource = new CancellationTokenSource();
  private readonly relationID = observableValue<string | undefined>(this, undefined);

  protected abstract doTrigger(...args: any[]): MaybePromise<void>;

  public readonly codeEditsContextBean = disposableObservableValue<CodeEditsContextBean | undefined>(this, undefined);
  public abstract priority: number;
  public abstract mount(): IDisposable;
  public get token() {
    return this.cancellationTokenSource.token;
  }

  public cancelToken() {
    this.cancellationTokenSource.cancel();
    this.cancellationTokenSource = new CancellationTokenSource();

    this.reporterEnd({ isCancel: true });
  }

  constructor(@Optional() protected readonly monacoEditor: ICodeEditor) {
    super();
  }

  protected get model() {
    return this.monacoEditor.getModel();
  }

  protected resetBean() {
    transaction((tx) => {
      this.cancelToken();
      this.codeEditsContextBean.set(undefined, tx);
    });
  }

  protected setBean(bean: ICodeEditsContextBean) {
    transaction((tx) => {
      const context = new CodeEditsContextBean(bean, this);
      this.codeEditsContextBean.set(context, tx);
    });
  }

  public reporterStart() {
    const context = this.codeEditsContextBean.get();
    if (context) {
      const relationID = this.aiReporter.start(AISerivceType.CodeEdits, {
        type: AISerivceType.CodeEdits,
        actionSource: context?.bean.typing,
      });

      transaction((tx) => {
        this.relationID.set(relationID, tx);
      });
    }
  }

  public reporterEnd(data: CodeEditsRT) {
    const relationID = this.relationID.get();
    if (relationID) {
      this.aiReporter.end(relationID, data);
    }
  }
}

@Injectable({ multiple: true })
export class CodeEditsSourceCollection extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  public readonly codeEditsContextBean = disposableObservableValue<CodeEditsContextBean | undefined>(this, undefined);

  constructor(
    private readonly constructorSources: ConstructorOf<BaseCodeEditsSource>[],
    private readonly monacoEditor: ICodeEditor,
  ) {
    super();

    const sources = this.constructorSources.map((source) => this.injector.get(source, [this.monacoEditor]));

    sources.forEach((source) => this.addDispose(source.mount()));

    const store = this.registerDispose(new DisposableStore());

    // 观察所有 source 的 codeEditsContextBean
    const observerCodeEditsContextBean = derived((reader) => ({
      codeEditsContextBean: new Map(sources.map((source) => [source, source.codeEditsContextBean.read(reader)])),
    }));

    this.addDispose(
      autorunDelta(
        // 这里需要做 debounce 0 处理，将多次连续的事务通知合并为一次
        debouncedObservable(observerCodeEditsContextBean, 0, store),
        ({ lastValue, newValue }) => {
          // 只拿最新的订阅值，如果 uid 相同，表示该值没有变化，就不用往下通知了
          const lastSources = sources.filter((source) => {
            const newBean = newValue?.codeEditsContextBean.get(source);
            const lastBean = lastValue?.codeEditsContextBean?.get(source);
            return newBean && (!lastBean || newBean.uid !== lastBean.uid);
          });

          let highestPriority = 0;
          let contextBean: CodeEditsContextBean | undefined;

          for (const source of lastSources) {
            const value = source.codeEditsContextBean.get();

            if (value && value.priority >= highestPriority) {
              highestPriority = value.priority;
              contextBean = value;
            }
          }

          transaction((tx) => {
            // 只通知最高优先级的结果
            this.codeEditsContextBean.set(contextBean, tx);
          });
        },
      ),
    );
  }
}
