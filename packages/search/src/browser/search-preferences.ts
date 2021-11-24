import { Injector } from '@opensumi/common-di';
import {
  PreferenceService,
  PreferenceProxy,
  createPreferenceProxy,
  PreferenceSchema,
  localize,
} from '@opensumi/ide-core-browser';

// 编写好 preference schema 配置
// 包括分组和选型
export const searchPreferenceSchema: PreferenceSchema = {
  id: 'search',
  order: 5,
  title: localize('Search', '搜索'),
  type: 'object',
  properties: {
    'search.exclude': {
      type: 'object',
      description: '%preference.search.exclude%',
      default: {
        '**/node_modules': true,
        '**/bower_components': true,
      },
    },
    'search.include': {
      type: 'object',
      description: '%preference.search.include%',
      default: {},
    },
    'search.useReplacePreview': {
      type: 'boolean',
      description: localize('preference.search.useReplacePreview'),
      default: true,
    },
  },
};

// 给 preference 项的值添加类型定义
export interface SearchConfiguration {
  'search.exclude': { [key: string]: boolean };
  'search.include': { [key: string]: boolean };
}

export const SearchPreferences = Symbol('SearchPreferences');
export type SearchPreferences = PreferenceProxy<SearchConfiguration>;

export const createSearchPreferencesProvider = (injector: Injector) => {
  return {
    token: SearchPreferences,
    useFactory: () => {
      const preferences: PreferenceService = injector.get(PreferenceService);
      return createPreferenceProxy(preferences, searchPreferenceSchema);
    },
  };
};

export function bindSearchPreference(injector: Injector) {
  injector.addProviders(createSearchPreferencesProvider(injector));
}
