import { IContextKey, IContextKeyService, IContextKeyExpr } from '@ali/ide-core-browser';

export class MonacoContextKeyService implements IContextKeyService {

  constructor(protected contextKeyService: monaco.contextKeyService.ContextKeyService) {}

  createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T> {
    return this.contextKeyService.createKey(key, defaultValue);
  }

  activeContext?: HTMLElement;

  match(expression: string |  IContextKeyExpr, context?: HTMLElement): boolean {
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
  }

  getContext() {
    const ctx = this.activeContext || (window.document.activeElement instanceof HTMLElement ? window.document.activeElement : undefined);
    return this.contextKeyService.getContext(ctx);
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
}
