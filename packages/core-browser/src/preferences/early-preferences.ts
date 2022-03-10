import { PreferenceItem, Event } from '@opensumi/ide-core-common';

import { IPreferences } from '../bootstrap';

import { PreferenceProvider } from './preference-provider';
import { PreferenceScope } from './preference-scope';

// 这些设置选项生效时间太早, 并且可能在app生命周期外生效，不能只由preference服务进行管理
export interface IExternalPreferenceProvider<T = any> {
  get(scope: PreferenceScope): T | undefined;
  set(value: T, scope: PreferenceScope): void;
  onDidChange?: Event<{ newValue?: T; oldValue?: T; scope: PreferenceScope }>;
}

const providers = new Map<string, IExternalPreferenceProvider>();

export function registerExternalPreferenceProvider<T>(name, provider: IExternalPreferenceProvider<T>) {
  if (providers.get(name)) {
    return; // 不可覆盖，先注册的生效
  }
  providers.set(name, provider);
}

export function getExternalPreferenceProvider(name) {
  let provider = providers.get(name);
  if (!provider) {
    // 尝试使用delegate的配置名获取
    const delegate = PreferenceProvider.PreferenceDelegates[name];
    if (delegate) {
      provider = providers.get(delegate.delegateTo);
    }
  }
  return provider;
}

export function getPreferenceThemeId(): string {
  return getExternalPreference<string>('general.theme').value as string;
}

export function getPreferenceIconThemeId(): string {
  return getExternalPreference<string>('general.icon').value as string;
}

export function getPreferenceLanguageId(defaultPreferences?: IPreferences): string {
  // 因为语言加载的时机比较早，因此会优先从 defaultPreferences 里面读取
  const langFromDefaultPreferences = defaultPreferences && defaultPreferences['general.language'];
  return langFromDefaultPreferences || getExternalPreference<string>('general.language').value || 'zh-CN';
}

// 默认使用localStorage
export function registerLocalStorageProvider(key: string, workspaceFolder?: string) {
  function getScopePrefix(scope: PreferenceScope) {
    if (scope === PreferenceScope.Workspace) {
      return workspaceFolder;
    }
    return scope;
  }
  registerExternalPreferenceProvider<string>(key, {
    set: (value, scope) => {
      if (scope >= PreferenceScope.Folder) {
        // earlyPreference不支持针对作用域大于等于Folder的值设置
        return;
      }

      if (!workspaceFolder && scope > PreferenceScope.Default) {
        // 不传入 workspaceDir 则只支持全局设置
        return;
      }

      if ((global as any).localStorage) {
        if (value !== undefined) {
          localStorage.setItem(getScopePrefix(scope) + `:${key}`, value);
        } else {
          localStorage.removeItem(getScopePrefix(scope) + `:${key}`);
        }
      }
    },
    get: (scope) => {
      if ((global as any).localStorage) {
        return localStorage.getItem(getScopePrefix(scope) + `:${key}`) || undefined;
      }
    },
  });
}

export function getExternalPreference<T>(
  preferenceName: string,
  schema?: PreferenceItem,
  untilScope?: PreferenceScope,
): { value: T | undefined; scope: PreferenceScope } {
  const scopes = untilScope
    ? PreferenceScope.getReversedScopes().filter((s) => s <= untilScope)
    : PreferenceScope.getReversedScopes();
  for (const scope of scopes) {
    const value = providers.get(preferenceName)!.get(scope);
    if (value !== undefined) {
      return {
        value,
        scope,
      };
    }
  }
  return {
    value: schema && schema.default,
    scope: PreferenceScope.Default,
  };
}

export function getAllExternalProviders(): Array<[string, IExternalPreferenceProvider]> {
  return Array.from(providers.entries());
}
