import { Disposable, Event, GeneralSettingsId, PreferenceItem, getLanguageId } from '@opensumi/ide-core-common';

import { IPreferences } from '../bootstrap';

import { PreferenceProvider } from './preference-provider';
import { PreferenceScope } from './preference-scope';

// 这些设置选项生效时间太早,并且可能在 app 生命周期外生效，不能只由 preference 服务进行管理
export interface IExternalPreferenceProvider<T = any> {
  get(scope: PreferenceScope): T | undefined;
  set(value: T, scope: PreferenceScope): void;
  onDidChange?: Event<{ newValue?: T; oldValue?: T; scope: PreferenceScope }>;
}

const providers = new Map<string, IExternalPreferenceProvider>();

export function registerExternalPreferenceProvider<T>(name: string, provider: IExternalPreferenceProvider<T>) {
  if (providers.get(name)) {
    // 不可覆盖，先注册的生效
    return Disposable.NULL;
  }
  providers.set(name, provider);

  return {
    dispose() {
      providers.delete(name);
    },
  };
}

export function getExternalPreferenceProvider(name: string) {
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
  return getExternalPreference<string>(GeneralSettingsId.Theme).value as string;
}

export function getPreferenceIconThemeId(): string {
  return getExternalPreference<string>(GeneralSettingsId.Icon).value as string;
}

/**
 * 如果要判断当前语言，请使用 `getLanguageId` 来判断。
 * 因为集成方可能会在集成后自己设置后调用 `setLanguageId` 来更新默认语言，所以统一收口到 `getLanguageId`。
 */
export function getPreferenceLanguageId(defaultPreferences?: IPreferences): string {
  // 默认从配置项中获取语言选项，其次从默认配置项中获取 `general.language`, 默认为 `en-US`
  const langFromDefaultPreferences = defaultPreferences && defaultPreferences[GeneralSettingsId.Language];
  const langExternalPreference = getExternalPreference<string>(GeneralSettingsId.Language);

  // 用户自定义语言设置优先于默认设置
  if (langExternalPreference.value && langExternalPreference.scope > PreferenceScope.Default) {
    return langExternalPreference.value;
  }

  return langFromDefaultPreferences || langExternalPreference.value || getLanguageId();
}

// 默认使用 localStorage
export function registerLocalStorageProvider(key: string, workspaceFolder?: string, prefix = '') {
  function getScopePrefix(scope: PreferenceScope) {
    let text: string = '';
    if (scope === PreferenceScope.Workspace && workspaceFolder) {
      text = workspaceFolder;
    } else {
      text = scope.toString();
    }

    if (prefix) {
      return prefix + ':' + text;
    }
    return text;
  }

  function createLocalStorageKey(scope: PreferenceScope) {
    return getScopePrefix(scope) + `:${key}`;
  }

  return registerExternalPreferenceProvider<string>(key, {
    set: (value, scope) => {
      if (scope >= PreferenceScope.Folder) {
        // earlyPreference不支持针对作用域大于等于Folder的值设置
        return;
      }

      if (!workspaceFolder && scope > PreferenceScope.Default) {
        // 不传入 workspaceDir 则只支持全局设置
        return;
      }

      if (typeof localStorage !== 'undefined') {
        if (value !== undefined) {
          localStorage.setItem(createLocalStorageKey(scope), value);
        } else {
          localStorage.removeItem(createLocalStorageKey(scope));
        }
      }
    },
    get: (scope) => {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(createLocalStorageKey(scope)) || undefined;
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
    const value = providers.get(preferenceName)?.get(scope);
    if (value) {
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
