import { Optional, Autowired, Injectable, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import {
  IContextKey,
  Event,
  IContextKeyService,
  ContextKeyChangeEvent,
  getDebugLogger,
  Emitter,
  IScopedContextKeyService,
  PreferenceService,
  PreferenceChanges,
  PreferenceScope,
  PreferenceSchemaProvider,
  createPreferenceProxy,
} from '@opensumi/ide-core-browser';
import { Disposable, ILogger } from '@opensumi/ide-core-common';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { Emitter as EventEmitter } from '@opensumi/monaco-editor-core/esm/vs/base/common/event';
import { StaticServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import {
  ConfigurationTarget,
  IConfigurationChangeEvent,
  IConfigurationService,
  IConfigurationOverrides,
  IConfigurationData,
  IConfigurationValue,
} from '@opensumi/monaco-editor-core/esm/vs/platform/configuration/common/configuration';
import { ContextKeyService } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/browser/contextKeyService';
import {
  ContextKeyExpression,
  IContextKeyServiceTarget,
  ContextKeyExpr,
} from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';
import { KeybindingResolver } from '@opensumi/monaco-editor-core/esm/vs/platform/keybinding/common/keybindingResolver';
import { IWorkspaceFolder } from '@opensumi/monaco-editor-core/esm/vs/platform/workspace/common/workspace';

// 新版本这个 magic string 没有导出了
const KEYBINDING_CONTEXT_ATTR = 'data-keybinding-context';

@Injectable()
export class ConfigurationService extends Disposable implements IConfigurationService {
  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(PreferenceSchemaProvider)
  private readonly preferenceSchemaProvider: PreferenceSchemaProvider;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  private readonly _onDidChangeConfiguration = new EventEmitter<IConfigurationChangeEvent>();
  public readonly onDidChangeConfiguration = this._onDidChangeConfiguration.event;
  public _serviceBrand: undefined;

  constructor() {
    super();
    this.preferenceService.onPreferencesChanged(this.triggerPreferencesChanged, this, this.disposables);
    const monacoConfigService = StaticServices.configurationService.get();
    monacoConfigService.getValue = this.getValue.bind(this);
  }

  public keys() {
    this.logger.error('MonacoConfigurationService#keys not implement');
    return {
      default: [],
      user: [],
      workspace: [],
      workspaceFolder: [],
      memory: [],
    };
  }

  // hack duck types for ContextKeyService
  // https://github.com/microsoft/vscode/blob/master/src/vs/platform/configuration/common/configuration.ts
  protected triggerPreferencesChanged(changesToEmit: PreferenceChanges) {
    const changes = Object.values(changesToEmit);
    const defaultScopeChanges = changes.filter((change) => change.scope === PreferenceScope.Default);
    const userScopeChanges = changes.filter((change) => change.scope === PreferenceScope.User);
    const workspaceScopeChanges = changes.filter((change) => change.scope === PreferenceScope.Workspace);
    const workspaceFolderScopeChanges = changes.filter((change) => change.scope === PreferenceScope.Folder);

    // 在 monaco-editor 内部，default scope 变化时需要刷新内置所有的 config 打头的对应的值
    if (defaultScopeChanges.length) {
      this._onDidChangeConfiguration.fire({
        affectedKeys: defaultScopeChanges.map((n) => n.preferenceName),
        source: ConfigurationTarget.DEFAULT,
        change: {
          keys: [],
          overrides: [],
        },
        // 判定配置是否生效
        affectsConfiguration(configuration: string) {
          return true;
        },
        sourceConfig: {},
      });
    }

    if (userScopeChanges.length) {
      this._onDidChangeConfiguration.fire({
        affectedKeys: userScopeChanges.map((n) => n.preferenceName),
        source: ConfigurationTarget.USER,
        change: {
          keys: [],
          overrides: [],
        },
        affectsConfiguration(configuration: string) {
          return true;
        },
        sourceConfig: {},
      });
    }

    if (workspaceScopeChanges.length) {
      this._onDidChangeConfiguration.fire({
        affectedKeys: workspaceScopeChanges.map((n) => n.preferenceName),
        source: ConfigurationTarget.WORKSPACE,
        change: {
          keys: [],
          overrides: [],
        },
        affectsConfiguration(configuration: string) {
          return true;
        },
        sourceConfig: {},
      });
    }

    if (workspaceFolderScopeChanges.length) {
      this._onDidChangeConfiguration.fire({
        affectedKeys: workspaceFolderScopeChanges.map((n) => n.preferenceName),
        source: this.workspaceService.isMultiRootWorkspaceOpened
          ? ConfigurationTarget.WORKSPACE_FOLDER
          : ConfigurationTarget.WORKSPACE,
        change: {
          keys: [],
          overrides: [],
        },
        affectsConfiguration(configuration: string) {
          return true;
        },
        sourceConfig: {},
      });
    }
  }

  public getValue<T>(section?: string): T;
  public getValue<T>(overrides: IConfigurationOverrides): T;
  public getValue<T>(sectionOrOverrides?: string | IConfigurationOverrides, overrides?: IConfigurationOverrides): T {
    let section;
    if (typeof sectionOrOverrides !== 'string') {
      overrides = sectionOrOverrides;
      section = undefined;
    } else {
      section = sectionOrOverrides;
    }
    const overrideIdentifier =
      (overrides && 'overrideIdentifier' in overrides && (overrides['overrideIdentifier'] as string)) || undefined;
    const resourceUri =
      overrides && 'resource' in overrides && !!overrides['resource'] && overrides['resource'].toString();
    const proxy = createPreferenceProxy<{ [key: string]: any }>(
      this.preferenceService,
      this.preferenceSchemaProvider.getCombinedSchema(),
      {
        resourceUri: resourceUri || undefined,
        overrideIdentifier,
        style: 'both',
      },
    );
    if (section) {
      return proxy[section] as T;
    }
    return proxy as any;
  }

  public async updateValue(key: string, value: any): Promise<void>;
  public async updateValue(
    key: string,
    value: any,
    targetOrOverrides?: ConfigurationTarget | IConfigurationOverrides,
    target?: ConfigurationTarget,
    donotNotifyError?: boolean,
  ): Promise<void> {
    let scope: PreferenceScope = PreferenceScope.Default;
    if (typeof target === 'number') {
      scope = this.getPreferenceScope(target);
    } else if (typeof targetOrOverrides === 'number') {
      scope = this.getPreferenceScope(targetOrOverrides);
    }
    const overrideIdentifier =
      (typeof targetOrOverrides === 'object' &&
        'overrideIdentifier' in targetOrOverrides &&
        (targetOrOverrides['overrideIdentifier'] as string)) ||
      undefined;
    const resourceUri =
      typeof targetOrOverrides === 'object' &&
      'resource' in targetOrOverrides &&
      !!targetOrOverrides['resource'] &&
      targetOrOverrides['resource'].toString();

    this.preferenceService.set(key, value, scope, resourceUri || '', overrideIdentifier);
  }

  public inspect<T>(key: string, overrides?: IConfigurationOverrides): IConfigurationValue<T> {
    const overrideIdentifier =
      (typeof overrides === 'object' &&
        'overrideIdentifier' in overrides &&
        (overrides['overrideIdentifier'] as string)) ||
      undefined;
    const resourceUri =
      typeof overrides === 'object' &&
      'resource' in overrides &&
      !!overrides['resource'] &&
      overrides['resource'].toString();
    const value = this.preferenceService.inspect(key, resourceUri || '', overrideIdentifier);
    const effectValue =
      typeof value?.workspaceFolderValue !== 'undefined'
        ? value?.workspaceFolderValue
        : typeof value?.workspaceValue !== 'undefined'
        ? value?.workspaceValue
        : typeof value?.globalValue !== 'undefined'
        ? value?.globalValue
        : typeof value?.defaultValue !== 'undefined'
        ? value?.defaultValue
        : undefined;

    return {
      defaultValue: value?.defaultValue as T,
      userValue: value?.globalValue as T,
      userLocalValue: value?.globalValue as T,
      userRemoteValue: value?.globalValue as T,
      workspaceValue: value?.workspaceValue as T,
      workspaceFolderValue: value?.workspaceFolderValue as T,
      memoryValue: undefined,
      value: effectValue as T,
      default: {
        value: value?.defaultValue as T,
        override: overrideIdentifier ? (value?.defaultValue as T) : undefined,
      },
      user: {
        value: value?.globalValue as T,
        override: overrideIdentifier ? (value?.globalValue as T) : undefined,
      },
      userLocal: {
        value: value?.globalValue as T,
        override: overrideIdentifier ? (value?.globalValue as T) : undefined,
      },
      userRemote: {
        value: value?.globalValue as T,
        override: overrideIdentifier ? (value?.globalValue as T) : undefined,
      },
      workspace: {
        value: value?.workspaceValue as T,
        override: overrideIdentifier ? (value?.workspaceValue as T) : undefined,
      },
      workspaceFolder: {
        value: value?.workspaceFolderValue as T,
        override: overrideIdentifier ? (value?.workspaceFolderValue as T) : undefined,
      },
      overrideIdentifiers: overrideIdentifier ? [overrideIdentifier] : undefined,
    };
  }

  public async reloadConfiguration(folder?: IWorkspaceFolder): Promise<void> {
    throw new Error('MonacoContextKeyService#reloadConfiguration method not implement');
  }

  private getPreferenceScope(target: ConfigurationTarget) {
    let scope: PreferenceScope;
    if (target === ConfigurationTarget.DEFAULT) {
      scope = PreferenceScope.Default;
    } else if (
      target === ConfigurationTarget.USER ||
      target === ConfigurationTarget.USER_LOCAL ||
      target === ConfigurationTarget.USER_REMOTE
    ) {
      scope = PreferenceScope.User;
    } else if (target === ConfigurationTarget.WORKSPACE) {
      scope = PreferenceScope.Workspace;
    } else if (target === ConfigurationTarget.WORKSPACE_FOLDER) {
      scope = PreferenceScope.Folder;
    } else {
      scope = PreferenceScope.Default;
    }
    return scope;
  }

  getConfigurationData(): IConfigurationData | null {
    throw new Error('MonacoContextKeyService#getConfigurationData method not implement');
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

  createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T> {
    return this.contextKeyService.createKey(key, defaultValue);
  }

  getKeysInWhen(when: string | ContextKeyExpression | undefined) {
    let expr: ContextKeyExpression | undefined;
    if (typeof when === 'string') {
      expr = this.parse(when);
    }
    return expr ? expr.keys() : [];
  }

  getContextValue<T>(key: string): T | undefined {
    return this.contextKeyService.getContextKeyValue(key);
  }

  getValue<T>(key: string): T | undefined {
    return this.contextKeyService.getContextKeyValue(key);
  }

  createScoped(target: IContextKeyServiceTarget | ContextKeyService): IScopedContextKeyService {
    if (target && isContextKeyService(target)) {
      return this.injector.get(ScopedContextKeyService, [target]);
    } else {
      // monaco 21 开始 domNode 变为必选
      // https://github.com/microsoft/vscode/commit/c88888aa9bcc76b05779edb21c19eb8c7ebac787
      const domNode = target || document.createElement('div');
      const scopedContextKeyService = this.contextKeyService.createScoped(domNode as IContextKeyServiceTarget);
      return this.injector.get(ScopedContextKeyService, [scopedContextKeyService as ContextKeyService]);
    }
  }

  // cache expressions
  protected expressions = new Map<string, ContextKeyExpression | undefined>();

  parse(when: string | undefined): ContextKeyExpression | undefined {
    if (!when) {
      return undefined;
    }

    let expression = this.expressions.get(when);
    if (!expression) {
      const parsedExpr = ContextKeyExpr.deserialize(when) as unknown;
      expression = parsedExpr ? (parsedExpr as ContextKeyExpression) : undefined;
      this.expressions.set(when, expression);
    }
    return expression;
  }

  dispose() {
    this.contextKeyService.dispose();
  }

  abstract match(expression: string | ContextKeyExpression, context?: HTMLElement | null): boolean;
}

@Injectable()
export class MonacoContextKeyService extends BaseContextKeyService implements IContextKeyService {
  @Autowired(IConfigurationService)
  protected readonly configurationService: IConfigurationService;

  public readonly contextKeyService: ContextKeyService;

  constructor() {
    super();
    this.contextKeyService = new ContextKeyService(this.configurationService);
    this.listenToContextChanges();
  }

  match(expression: string | ContextKeyExpression | undefined, context?: HTMLElement): boolean {
    try {
      // keybinding 将 html target 传递过来完成激活区域的 context 获取和匹配
      const ctx =
        context || (window.document.activeElement instanceof HTMLElement ? window.document.activeElement : undefined);
      let parsed: ContextKeyExpression | undefined;
      if (typeof expression === 'string') {
        parsed = this.parse(expression);
      } else {
        parsed = expression;
      }

      // 如果匹配表达式时没有传入合适的 DOM，则使用全局 ContextKeyService 进行表达式匹配
      if (!ctx) {
        return this.contextKeyService.contextMatchesRules(parsed as any);
      }

      // 自行指定 KeybindingResolver.contextMatchesRules 的 Context，来自于当前的激活元素的 Context
      // 如果 ctx 为 null 则返回 0 (应该是根 contextKeyService 的 context_id 即为 global 的 ctx key service)
      // 找到 ctx DOM 上的 context_id 属性 则直接返回
      // 如果找不到 ctx DOM 上的 context_id 返回 NaN
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

  match(expression: string | ContextKeyExpression | undefined): boolean {
    try {
      let parsed: ContextKeyExpression | undefined;
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
    this.contextKeyService['_domNode'].setAttribute(
      KEYBINDING_CONTEXT_ATTR,
      String(this.contextKeyService['_myContextId']),
    );
  }
}
