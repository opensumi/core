import { IContextKey, IContextKeyService, IContextKeyExpr, Event, IContextKeyChangeEventPayload, IEventBus, ContextKeyChangeEvent, getLogger } from '@ali/ide-core-browser';

export class MonacoContextKeyService implements IContextKeyService {

  constructor(protected contextKeyService: monaco.contextKeyService.ContextKeyService, private eventBus: IEventBus) {
    this.contextKeyService.onDidChangeContext((payload) => {
      eventBus.fire(new ContextKeyChangeEvent(payload));
    });
  }

  createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T> {
    return this.contextKeyService.createKey(key, defaultValue);
  }

  getContextValue<T>(key: string): T {
    return (this.contextKeyService as any).getContextValuesContainer((this.contextKeyService as any)._myContextId).getValue(key);
  }

  activeContext?: HTMLElement;

  match(expression: string |  IContextKeyExpr, context?: HTMLElement): boolean {
    try {
      const ctx = context || this.activeContext || (window.document.activeElement instanceof HTMLElement ? window.document.activeElement : undefined);
      let parsed: monaco.contextkey.ContextKeyExpr;
      if (typeof expression === 'string') {
        parsed = this.parse(expression);
      } else {
        parsed = expression;
      }
      if (!ctx) {
          return this.contextKeyService.contextMatchesRules(parsed);
      }
      const keyContext = this.contextKeyService.getContext(ctx);
      return monaco.keybindings.KeybindingResolver.contextMatchesRules(keyContext, parsed);
    } catch (e) {
      getLogger().error(e);
      return false;
    }
  }

  getKeysInWhen(when: string) {
    const expr = this.parse(when);
    return expr.keys();
  }

  getContext() {
    const ctx = this.activeContext || (window.document.activeElement instanceof HTMLElement ? window.document.activeElement : undefined);
    return this.contextKeyService.getContext(ctx);
  }

  // cache
  protected readonly expressions = new Map<string, monaco.contextkey.ContextKeyExpr>();

  protected parse(when: string): monaco.contextkey.ContextKeyExpr {
    let expression = this.expressions.get(when);
    if (!expression) {
        expression = monaco.contextkey.ContextKeyExpr.deserialize(when);
        this.expressions.set(when, expression);
    }
    return expression;
  }

  createScoped(): IContextKeyService {
    return new ScopedContextKeyService(this.contextKeyService.createScoped());
  }
}

export class ScopedContextKeyService implements IContextKeyService {

  constructor(protected contextKeyService: monaco.contextKeyService.ContextKeyService) {}

  createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T> {
    return this.contextKeyService.createKey(key, defaultValue);
  }

  activeContext?: HTMLElement;

  match(expression: string |  IContextKeyExpr): boolean {
    let parsed: monaco.contextkey.ContextKeyExpr;
    if (typeof expression === 'string') {
      parsed = this.parse(expression);
    } else {
      parsed = expression;
    }
    const keyContext = this.getContext();
    return monaco.keybindings.KeybindingResolver.contextMatchesRules(keyContext, parsed);
  }

  getContext() {
    return this.contextKeyService.getContextValuesContainer(this.contextKeyService._myContextId);
  }

  getKeysInWhen(when: string) {
    const expr = this.parse(when);
    return expr.keys();
  }

  protected readonly expressions = new Map<string, monaco.contextkey.ContextKeyExpr>();
  protected parse(when: string): monaco.contextkey.ContextKeyExpr {
    let expression = this.expressions.get(when);
    if (!expression) {
        expression = monaco.contextkey.ContextKeyExpr.deserialize(when);
        this.expressions.set(when, expression);
    }
    return expression;
  }

  getContextValue<T>(key: string): T {
    return this.contextKeyService.getContextValuesContainer(this.contextKeyService._myContextId).getValue(key);
  }

  createScoped(): IContextKeyService {
    return new ScopedContextKeyService(this.contextKeyService.createScoped());
  }

}
