import { Autowired, INJECTOR_TOKEN, Injectable, Injector, Optional } from '@opensumi/di';
import {
  CancellationTokenSource,
  ConstructorOf,
  Disposable,
  IDisposable,
  MaybePromise,
  uuid,
} from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { DisposableStore } from '@opensumi/monaco-editor-core/esm/vs/base/common/lifecycle';
import {
  autorunDelta,
  debouncedObservable,
  derived,
  disposableObservableValue,
  transaction,
} from '@opensumi/monaco-editor-core/esm/vs/base/common/observable';

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
}

@Injectable({ multiple: true })
export abstract class BaseCodeEditsSource extends Disposable {
  protected abstract doTrigger(...args: any[]): MaybePromise<void>;

  public readonly codeEditsContextBean = disposableObservableValue<CodeEditsContextBean | undefined>(this, undefined);

  public abstract priority: number;
  public abstract mount(): IDisposable;

  constructor(@Optional() protected readonly monacoEditor: ICodeEditor) {
    super();
  }

  protected get model() {
    return this.monacoEditor.getModel();
  }

  protected resetBean() {
    transaction((tx) => {
      this.codeEditsContextBean.set(undefined, tx);
    });
  }

  protected setBean(bean: ICodeEditsContextBean) {
    transaction((tx) => {
      const context = new CodeEditsContextBean(bean, this);
      this.codeEditsContextBean.set(context, tx);
    });
  }
}

@Injectable({ multiple: true })
export class CodeEditsSourceCollection extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  private cancellationTokenSource = new CancellationTokenSource();

  public readonly codeEditsContextBean = disposableObservableValue<CodeEditsContextBean | undefined>(this, undefined);

  public get token() {
    return this.cancellationTokenSource.token;
  }

  public cancelToken() {
    this.cancellationTokenSource.cancel();
    this.cancellationTokenSource = new CancellationTokenSource();
  }

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
