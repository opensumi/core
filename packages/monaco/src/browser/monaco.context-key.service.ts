import {
  IContextKey, IContextKeyService, Event, IEventBus,
  ContextKeyChangeEvent, getLogger, Emitter,
} from '@ali/ide-core-browser';

abstract class BaseContextKeyService implements IContextKeyService {
  protected _onDidChangeContext = new Emitter<ContextKeyChangeEvent>();
  readonly onDidChangeContext: Event<ContextKeyChangeEvent> = this._onDidChangeContext.event;

  constructor(protected contextKeyService: monaco.contextKeyService.ContextKeyService) {}

  activeContext?: HTMLElement;

  createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T> {
    return this.contextKeyService.createKey(key, defaultValue);
  }

  getKeysInWhen(when: string | monaco.contextkey.ContextKeyExpr | undefined) {
    let expr: monaco.contextkey.ContextKeyExpr | undefined;
    if (typeof when === 'string') {
      expr = this.parse(when);
    }
    return expr ? expr.keys() : [];
  }

  getContextValue<T>(key: string): T | undefined {
    return this.contextKeyService.getContextValuesContainer(this.contextKeyService._myContextId).getValue<T>(key);
  }

  createScoped(domNode: monaco.contextkey.IContextKeyServiceTarget): IContextKeyService {
    const scopedContextKeySerivce = this.contextKeyService.createScoped(domNode) as monaco.contextKeyService.ContextKeyService;
    return new ScopedContextKeyService(scopedContextKeySerivce);
  }

  // cache expressions
  protected expressions = new Map<string, monaco.contextkey.ContextKeyExpr | undefined>();
  // internal used
  parse(when: string | undefined): monaco.contextkey.ContextKeyExpr | undefined {
    if (!when) {
      return undefined;
    }

    let expression = this.expressions.get(when);
    if (!expression) {
      expression = monaco.contextkey.ContextKeyExpr.deserialize(when);
      this.expressions.set(when, expression);
    }
    return expression;
  }

  abstract match(expression: string | monaco.contextkey.ContextKeyExpr, context?: HTMLElement): boolean;
  abstract dispose(): void;
}

export class MonacoContextKeyService extends BaseContextKeyService implements IContextKeyService {
  constructor(protected contextKeyService: monaco.contextKeyService.ContextKeyService, eventBus: IEventBus) {
    super(contextKeyService);
    this.contextKeyService.onDidChangeContext((payload) => {
      this._onDidChangeContext.fire(new ContextKeyChangeEvent(payload));
      /**
       * @deprecated
       * todo: 将 electron menu renderer 部分修改下，监听 this.onDidChangeContext 即可
       */
      eventBus.fire(new ContextKeyChangeEvent(payload));
    });
  }

  match(expression: string | monaco.contextkey.ContextKeyExpr | undefined, context?: HTMLElement): boolean {
    try {
      // 这里存在手动管理 context 的使用，可以直接在 contextService 上挂载 context 完成 context 传递
      // 这样做真的好脏，还不如要求传递进来呢
      // thiea 中是通过 activeElement 来搞 quickopen 的上下文的, 见 thiea/packages/monaco/src/browser/monaco-quick-open-service.ts
      const ctx = context || this.activeContext || (window.document.activeElement instanceof HTMLElement ? window.document.activeElement : undefined);
      let parsed: monaco.contextkey.ContextKeyExpr | undefined;
      if (typeof expression === 'string') {
        parsed = this.parse(expression);
      } else {
        parsed = expression;
      }

      // what's this?
      // this contextKeyService 即当前 ctx key serivce 节点的 contextKeySerivce 啊
      // 当前这个 ctx key service 即为根 ctx key service
      if (!ctx) {
        // KeybindingResolver.contextMatchesRules 的 context 来自于 this._myContextId
        return this.contextKeyService.contextMatchesRules(parsed);
      }

      // 自行指定 KeybindingResolver.contextMatchesRules 的 context，来自于当前的 ctx 元素的 context
      // 如果 ctx 为 null 则返回 0 (应该是根 ctxkey service 的 context_id 即为 global 的 ctx key service)
      // 找到 ctx dom 上的 context_id 属性 则直接返回
      // 如果找不到 ctx dom 上的 context_id 返回 NaN
      // 如果遍历到父节点为 html 时，其 parentElement 为 null，也会返回 0
      const keyContext = this.contextKeyService.getContext(ctx);
      return monaco.keybindings.KeybindingResolver.contextMatchesRules(keyContext, parsed);
    } catch (e) {
      getLogger().error(e);
      return false;
    }
  }

  dispose() {
    this.contextKeyService.dispose();
  }
}

class ScopedContextKeyService extends BaseContextKeyService implements IContextKeyService {
  constructor(protected contextKeyService: monaco.contextKeyService.ContextKeyService) {
    super(contextKeyService);
    this.contextKeyService.onDidChangeContext((payload) => {
      this._onDidChangeContext.fire(new ContextKeyChangeEvent(payload));
    });
  }

  match(expression: string | monaco.contextkey.ContextKeyExpr | undefined): boolean {
    try {
      let parsed: monaco.contextkey.ContextKeyExpr | undefined;
      if (typeof expression === 'string') {
        parsed = this.parse(expression);
      } else {
        parsed = expression;
      }

      return this.contextKeyService.contextMatchesRules(parsed);
    } catch (e) {
      getLogger().error(e);
      return false;
    }
  }

  dispose() {
    this.contextKeyService.dispose();
  }
}
