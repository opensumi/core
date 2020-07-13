import {
  IContextKey, IContextKeyService, Event,
  ContextKeyChangeEvent, getDebugLogger, Emitter,
  IScopedContextKeyService, PreferenceService, PreferenceChanges, PreferenceScope,
} from '@ali/ide-core-browser';
import { Disposable } from '@ali/ide-core-common';
import { Optional, Autowired, Injectable, Injector, INJECTOR_TOKEN } from '@ali/common-di';

import { ContextKeyService } from '@reexport/vsc-modules/lib/contextkey';
import { Emitter as EventEmitter } from '@reexport/vsc-modules/lib/base/common/event';
import { ContextKeyExpr } from '@reexport/vsc-modules/lib/contextkey/common/contextkey';
import { KeybindingResolver } from '@reexport/vsc-modules/lib/contextkey/keybindingResolver';
import { IConfigurationChangeEvent, IConfigurationService, DEFAULT_CONFIG_LEVEL } from '@reexport/vsc-modules/lib/contextkey/common/configuration';

const KEYBINDING_CONTEXT_ATTR = KeybindingResolver.KEYBINDING_CONTEXT_ATTR;

@Injectable()
export class ConfigurationService extends Disposable implements IConfigurationService {
  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  private readonly _onDidChangeConfiguration = new EventEmitter<IConfigurationChangeEvent>();
  public readonly onDidChangeConfiguration = this._onDidChangeConfiguration.event;

  constructor() {
    super();
    this.preferenceService.onPreferencesChanged(this.triggerPreferencesChanged, this, this.disposables);
  }

  // hack duck types for ContextKeyService
  // https://yuque.antfin-inc.com/zymuwz/lsxfi3/kg9bng#5wAGA
  // https://github.com/microsoft/vscode/blob/master/src/vs/platform/configuration/common/configuration.ts
  protected triggerPreferencesChanged(changesToEmit: PreferenceChanges) {
    const changes = Object.values(changesToEmit);
    const defaultScopeChanges = changes.filter((change) => change.scope === PreferenceScope.Default);
    const otherScopeChanges = changes.filter((change) => change.scope !== PreferenceScope.Default);

    // 在 monaco-editor 内部，default scope 变化时需要刷新内置所有的 config 打头的对应的值
    if (defaultScopeChanges.length) {
      this._onDidChangeConfiguration.fire({
        affectedKeys: defaultScopeChanges.map((n) => n.preferenceName),
        source: DEFAULT_CONFIG_LEVEL,
      });
    }

    if (otherScopeChanges.length) {
      this._onDidChangeConfiguration.fire({
        affectedKeys: otherScopeChanges.map((n) => n.preferenceName),
        source: '',
      });
    }
  }

  public getValue<T>(preferenceName: string): T {
    return this.preferenceService.resolve<T>(preferenceName).value as T;
  }
}

export function isContextKeyService(thing: any): thing is ContextKeyService {
  return thing['_myContextId'] !== undefined;
}

@Injectable()
abstract class BaseContextKeyService extends Disposable implements IContextKeyService {
  protected _onDidChangeContext = new Emitter<ContextKeyChangeEvent>();
  readonly onDidChangeContext: Event<ContextKeyChangeEvent> = this._onDidChangeContext.event;

  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  public contextKeyService: ContextKeyService;

  constructor() {
    super();
  }

  listenToContextChanges() {
    this.addDispose(
      this.contextKeyService.onDidChangeContext((payload) => {
        this._onDidChangeContext.fire(new ContextKeyChangeEvent(payload));
      }),
    );
  }

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
    return this.contextKeyService.getContextKeyValue(key);
  }

  createScoped(target: monaco.contextkey.IContextKeyServiceTarget | monaco.contextKeyService.ContextKeyService): IScopedContextKeyService {
    if (target && isContextKeyService(target)) {
      return this.injector.get(ScopedContextKeyService, [target]);
    } else {
      const scopedContextKeyService = this.contextKeyService.createScoped(target as monaco.contextkey.IContextKeyServiceTarget);
      return this.injector.get(ScopedContextKeyService, [scopedContextKeyService as ContextKeyService]);
    }
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
      const parsedExpr = ContextKeyExpr.deserialize(when) as unknown;
      expression = parsedExpr ? parsedExpr as monaco.contextkey.ContextKeyExpr : undefined;
      this.expressions.set(when, expression);
    }
    return expression;
  }

  dispose() {
    this.contextKeyService.dispose();
  }

  abstract match(expression: string | monaco.contextkey.ContextKeyExpr, context?: HTMLElement | null): boolean;
}

@Injectable()
export class MonacoContextKeyService extends BaseContextKeyService implements IContextKeyService {
  public readonly contextKeyService: ContextKeyService;

  constructor() {
    super();
    this.contextKeyService = new ContextKeyService(this.injector.get(ConfigurationService));
    this.listenToContextChanges();
  }

  match(expression: string | monaco.contextkey.ContextKeyExpr | undefined, context?: HTMLElement): boolean {
    try {
      // keybinding 将 html target 传递过来完成激活区域的 context 获取和匹配
      // thiea 中是通过 activeElement 来搞 quickopen 的上下文的, 见 thiea/packages/monaco/src/browser/monaco-quick-open-service.ts
      const ctx = context || this.activeContext || (window.document.activeElement instanceof HTMLElement ? window.document.activeElement : undefined);
      let parsed: monaco.contextkey.ContextKeyExpr | undefined;
      if (typeof expression === 'string') {
        parsed = this.parse(expression);
      } else {
        parsed = expression;
      }

      // what's this?
      // this contextKeyService 即当前 ctx key service 节点的 contextKeyService 啊
      // 当前这个 ctx key service 即为根 ctx key service
      if (!ctx) {
        // KeybindingResolver.contextMatchesRules 的 context 来自于 this._myContextId
        return this.contextKeyService.contextMatchesRules(parsed as any);
      }

      // 自行指定 KeybindingResolver.contextMatchesRules 的 context，来自于当前的 ctx 元素的 context
      // 如果 ctx 为 null 则返回 0 (应该是根 contextKeyService 的 context_id 即为 global 的 ctx key service)
      // 找到 ctx dom 上的 context_id 属性 则直接返回
      // 如果找不到 ctx dom 上的 context_id 返回 NaN
      // 如果遍历到父节点为 html 时，其 parentElement 为 null，也会返回 0
      const keyContext = this.contextKeyService.getContext(ctx);
      return KeybindingResolver.contextMatchesRules(keyContext, parsed as any);
    } catch (e) {
      getDebugLogger().error(e);
      return false;
    }
  }
}

@Injectable({ multiple: true })
class ScopedContextKeyService extends BaseContextKeyService implements IScopedContextKeyService {
  constructor(@Optional() public readonly contextKeyService: ContextKeyService) {
    super();
    this.listenToContextChanges();
  }

  match(expression: string | monaco.contextkey.ContextKeyExpr | undefined): boolean {
    try {
      let parsed: monaco.contextkey.ContextKeyExpr | undefined;
      if (typeof expression === 'string') {
        parsed = this.parse(expression);
      } else {
        parsed = expression;
      }
      // getType 的类型不兼容
      return this.contextKeyService.contextMatchesRules(parsed as any);
    } catch (e) {
      getDebugLogger().error(e);
      return false;
    }
  }

  attachToDomNode(domNode: HTMLElement) {
    // _domNode 存在于 ScopedContextKeyService 上
    if (this.contextKeyService['_domNode']) {
      this.contextKeyService['_domNode'].removeAttribute(KEYBINDING_CONTEXT_ATTR);
    }
    this.contextKeyService['_domNode'] = domNode;
    this.contextKeyService['_domNode'].setAttribute(KEYBINDING_CONTEXT_ATTR, String(this.contextKeyService['_myContextId']));
  }
}
