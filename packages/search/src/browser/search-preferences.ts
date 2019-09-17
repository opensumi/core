import { Injector } from '@ali/common-di';
import {
  PreferenceService,
  PreferenceProxy,
  createPreferenceProxy,
  PreferenceSchema,
  localize,
} from '@ali/ide-core-browser';

// 编写好 preference schema 配置
// 包括分组和选型
export const searchPreferenceSchema: PreferenceSchema = {
  id: 'search',
  order: 5,
  title: localize('Search', 'Search'),
  type: 'object',
  properties: {
    'search.exclude': {
      type: 'array',
      description: localize('exclude', '配置在搜索中排除的文件和文件夹的 glob 模式。已经继承 `#files.exclude#` 设置的所有 glob 模式。'),
      default: ['**/node_modules', '**/bower_components'],
    },
  },
};

// 给 preference 项的值添加类型定义
export interface SearchConfiguration {
  'search.exclude': string[];
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
