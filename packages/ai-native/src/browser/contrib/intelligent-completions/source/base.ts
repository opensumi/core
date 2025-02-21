import { Autowired, INJECTOR_TOKEN, Injectable, Injector, Optional } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import {
  AIServiceType,
  CodeEditsRT,
  ConstructorOf,
  Disposable,
  IAIReporter,
  IDisposable,
  uuid,
} from '@opensumi/ide-core-common';
import { CancellationTokenSource, ICodeEditor } from '@opensumi/ide-monaco';
import {
  autorunDelta,
  debouncedObservable2,
  derived,
  disposableObservableValue,
  observableValue,
  transaction,
} from '@opensumi/ide-monaco/lib/common/observable';

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

  public get typing() {
    return this.raw.typing;
  }

  public get position() {
    return this.raw.position;
  }

  public get data() {
    return this.raw.data;
  }

  public get token() {
    return this.source.token;
  }

  public joinData(data: ICodeEditsContextBean['data']) {
    this.raw.data = { ...this.data, ...data };
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
  private readonly aiReporter: IAIReporter;

  @Autowired(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  private cancellationTokenSource = new CancellationTokenSource();
  private readonly relationID = observableValue<string | undefined>(this, undefined);

  public readonly codeEditsContextBean = disposableObservableValue<CodeEditsContextBean | undefined>(this, undefined);
  public abstract priority: number;
  public abstract mount(): IDisposable;
  public get token() {
    return this.cancellationTokenSource.token;
  }

  public cancelToken() {
    this.cancellationTokenSource.cancel();
    this.cancellationTokenSource = new CancellationTokenSource();

    this.reporterEnd({ isValid: false });
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

  protected setBean(bean: Omit<ICodeEditsContextBean, 'position'>) {
    transaction((tx) => {
      const context = new CodeEditsContextBean({ ...bean, position: this.monacoEditor.getPosition()! }, this);
      this.codeEditsContextBean.set(context, tx);
    });
  }

  public reporterStart() {
    const context = this.codeEditsContextBean.get();
    if (context) {
      const relationID = this.aiReporter.start(AIServiceType.CodeEdits, {
        type: AIServiceType.CodeEdits,
        actionSource: context?.typing,
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

  private sources: BaseCodeEditsSource[] = [];
  public readonly codeEditsContextBean = disposableObservableValue<CodeEditsContextBean | undefined>(this, undefined);

  public getSource(source: ConstructorOf<BaseCodeEditsSource>): BaseCodeEditsSource | undefined {
    return this.sources.find((s) => s instanceof source);
  }

  constructor(
    private readonly constructorSources: ConstructorOf<BaseCodeEditsSource>[],
    private readonly monacoEditor: ICodeEditor,
  ) {
    super();

    this.sources = this.constructorSources.map((source) => this.injector.get(source, [this.monacoEditor]));

    this.sources.forEach((source) => this.addDispose(source.mount()));

    // 观察所有 source 的 codeEditsContextBean
    const observerCodeEditsContextBean = derived((reader) => ({
      codeEditsContextBean: new Map(this.sources.map((source) => [source, source.codeEditsContextBean.read(reader)])),
    }));

    this.addDispose(
      autorunDelta(
        // 这里需要做 debounce 0 处理，将多次连续的事务通知合并为一次
        debouncedObservable2(observerCodeEditsContextBean, 0),
        ({ lastValue, newValue }) => {
          // 只拿最新的订阅值，如果 uid 相同，表示该值没有变化，就不用往下通知了
          const lastSources = this.sources.filter((source) => {
            const newBean = newValue?.codeEditsContextBean.get(source);
            const lastBean = lastValue?.codeEditsContextBean?.get(source);
            return newBean && (!lastBean || newBean.uid !== lastBean.uid);
          });

          let highestPriority = 0;
          let contextBean: CodeEditsContextBean | undefined;

          for (const source of lastSources) {
            const value = source.codeEditsContextBean.get();
            if (!value) {
              return;
            }

            if (!contextBean) {
              contextBean = value;
            }

            if (value.priority >= highestPriority) {
              highestPriority = value.priority;

              value.joinData(contextBean.data);
              contextBean = value;
            }

            // 将多个 source 的 data 合并到一起
            contextBean.joinData(value.data);
          }

          transaction((tx) => {
            this.codeEditsContextBean.set(contextBean, tx);
          });
        },
      ),
    );
  }
}
