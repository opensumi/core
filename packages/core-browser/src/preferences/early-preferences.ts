import { PreferenceScope } from './preference-scope';

// 这些设置选项生效时间太早, 并且可能在app生命周期外生效，不能只由preference服务进行管理
export interface IExternalPreferenceProvider<T = any> {
  get(scope: PreferenceScope): T | undefined | null;
  set(value: T, scope: PreferenceScope): void;
}

const providers = new Map<string, IExternalPreferenceProvider>();

export function registerExternalPreferenceProvider<T>(name, provider: IExternalPreferenceProvider<T>) {
  providers.set(name, provider); // 可覆盖
}

export function getExternalPreferenceProvider(name) {
  return providers.get(name);
}

export function getPreferenceThemeId(): string {
  return providers.get('general.theme')!.get(PreferenceScope.Workspace) || providers.get('general.theme')!.get(PreferenceScope.User) || providers.get('general.theme')!.get(PreferenceScope.Default);
}

export function getPreferenceLanguageId(): string {
  return providers.get('general.language')!.get(PreferenceScope.Workspace) || providers.get('general.language')!.get(PreferenceScope.User) || providers.get('general.language')!.get(PreferenceScope.Default);
}

// 默认使用localStorage
registerExternalPreferenceProvider<string>('general.theme', {
  set: (value, scope) => {
    localStorage.setItem(scope + ':general.theme', value);
  },
  get: (scope) => {
    return localStorage.getItem(scope + ':general.theme');
  },
});

registerExternalPreferenceProvider<string>('general.language', {
  set: (value, scope) => {
    localStorage.setItem(scope + ':general.language', value);
  },
  get: (scope) => {
    return localStorage.getItem(scope + ':general.language') || 'zh-CN';
  },
});
