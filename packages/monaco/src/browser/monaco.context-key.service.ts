import { IContextKey, IContextKeyService } from '@ali/ide-core-browser';

export class MonacoContextKeyService implements IContextKeyService {

  constructor(protected contextKeyService: monaco.contextKeyService.ContextKeyService) {}

  createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T> {
    return this.contextKeyService.createKey(key, defaultValue);
  }

  activeContext?: HTMLElement;

  match(expression: string, context?: HTMLElement): boolean {
    const ctx = context || this.activeContext || (window.document.activeElement instanceof HTMLElement ? window.document.activeElement : undefined);
    const parsed = this.parse(expression);
    if (!ctx) {
        return this.contextKeyService.contextMatchesRules(parsed);
    }
    const keyContext = this.contextKeyService.getContext(ctx);
    return monaco.keybindings.KeybindingResolver.contextMatchesRules(keyContext, parsed);
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
