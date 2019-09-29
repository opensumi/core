import { PreferenceScope } from './preference-scope';

// 这些设置选项生效时间太早, 并且可能在app生命周期外生效，不能只由preference服务进行管理
export interface IExternalPreferenceProvider<T = any> {
  get(scope: PreferenceScope): T | undefined;
  set(value: T, scope: PreferenceScope): void;
  onDidChange?: ({value: T, scope: PreferenceScope}) => void;
}

const providers = new Map<string, IExternalPreferenceProvider>();

export function registerExternalPreferenceProvider<T>(name, provider: IExternalPreferenceProvider<T>) {
  providers.set(name, provider); // 可覆盖
}

export function getExternalPreferenceProvider(name) {
  return providers.get(name);
}

export function getPreferenceThemeId(): string {
  return getExternalPreference<string>('general.theme').value;
}

export function getPreferenceLanguageId(): string {
  return getExternalPreference<string>('general.language').value;
}

// 默认使用localStorage
registerExternalPreferenceProvider<string>('general.theme', {
  set: (value, scope) => {
    localStorage.setItem(scope + ':general.theme', value);
  },
  get: (scope) => {
    return localStorage.getItem(scope + ':general.theme') || undefined;
  },
});

registerExternalPreferenceProvider<string>('general.language', {
  set: (value, scope) => {
    localStorage.setItem(scope + ':general.language', value);
  },
  get: (scope) => {
    return localStorage.getItem(scope + ':general.language') || undefined;
  },
});

export function getExternalPreference<T>(preferenceName: string): {value: T, scope: PreferenceScope } {
  for (const scope of PreferenceScope.getReversedScopes()) {
    const value = providers.get(preferenceName)!.get(scope);
    if (value !== undefined) {
      return {
        value,
        scope,
      };
    }
  }
  return {
    value: undefined as any,
    scope: PreferenceScope.Default,
  };
}
