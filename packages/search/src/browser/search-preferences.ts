import { Injector } from '@opensumi/di';
import {
  PreferenceService,
  PreferenceProxy,
  createPreferenceProxy,
  PreferenceSchema,
  localize,
} from '@opensumi/ide-core-browser';
import { SearchSettingId } from '@opensumi/ide-core-common/lib/settings/search';

// 编写好 preference schema 配置
// 包括分组和选型
export const searchPreferenceSchema: PreferenceSchema = {
  id: 'search',
  order: 5,
  title: localize('Search', '搜索'),
  type: 'object',
  properties: {
    [SearchSettingId.Exclude]: {
      type: 'object',
      description: '%preference.search.exclude%',
      default: {
        '**/node_modules': true,
        '**/bower_components': true,
        '**/.git': true,
        '**/.svn': true,
        '**/.hg': true,
        '**/CVS': true,
        '**/.DS_Store': true,
        '**/Thumbs.db': true,
      },
    },
    [SearchSettingId.Include]: {
      type: 'object',
      description: '%preference.search.include%',
      default: {},
    },
    [SearchSettingId.UseReplacePreview]: {
      type: 'boolean',
      description: localize('preference.search.useReplacePreview'),
      default: true,
    },
    [SearchSettingId.SearchOnType]: {
      type: 'boolean',
      description: localize('preference.search.searchOnType'),
      default: true,
    },
    [SearchSettingId.SearchOnTypeDebouncePeriod]: {
      type: 'number',
      description: localize('preference.search.searchOnTypeDebouncePeriod'),
      default: 300,
    },
  },
};

// 给 preference 项的值添加类型定义
export interface SearchConfiguration {
  [SearchSettingId.Exclude]: { [key: string]: boolean };
  [SearchSettingId.Include]: { [key: string]: boolean };
  [SearchSettingId.UseReplacePreview]: boolean;
  [SearchSettingId.SearchOnType]: boolean;
  [SearchSettingId.SearchOnTypeDebouncePeriod]: number;
}

export const SearchPreferences = Symbol('SearchPreferences');
export type SearchPreferences = PreferenceProxy<SearchConfiguration>;

export const createSearchPreferencesProvider = (injector: Injector) => ({
  token: SearchPreferences,
  useFactory: () => {
    const preferences: PreferenceService = injector.get(PreferenceService);
    return createPreferenceProxy(preferences, searchPreferenceSchema);
  },
});

export function bindSearchPreference(injector: Injector) {
  injector.addProviders(createSearchPreferencesProvider(injector));
}
