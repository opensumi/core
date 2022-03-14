import { Injector } from '@opensumi/di';
import {
  PreferenceService,
  PreferenceProxy,
  createPreferenceProxy,
  PreferenceSchema,
  localize,
} from '@opensumi/ide-core-browser';

import { SCMViewModelMode } from '../common';

// 这里都是 scm 相关配置项注册
/* istanbul ignore file */
export const scmPreferenceSchema: PreferenceSchema = {
  id: 'scm',
  order: 5,
  title: localize('scmConfigurationTitle', 'SCM'),
  type: 'object',
  properties: {
    'scm.alwaysShowProviders': {
      type: 'boolean',
      description: localize(
        'alwaysShowProviders',
        'Controls whether to always show the Source Control Provider section.',
      ),
      default: false,
    },
    'scm.providers.visible': {
      type: 'number',
      description: localize(
        'providersVisible',
        'Controls how many providers are visible in the Source Control Provider section. Set to `0` to be able to manually resize the view.',
      ),
      default: 10,
    },
    'scm.diffDecorations': {
      type: 'string',
      enum: ['all', 'gutter', 'overview', 'none'],
      default: 'all',
      description: localize('diffDecorations', 'Controls diff decorations in the editor.'),
    },
    'scm.alwaysShowDiffWidget': {
      type: 'boolean',
      description: localize('alwaysShowDiffWidget', 'Controls whether to always click to show the Dirty Diff Widget.'),
      default: true,
    },
    'scm.diffDecorationsGutterWidth': {
      type: 'number',
      enum: [1, 2, 3, 4, 5],
      default: 3,
      description: localize(
        'diffGutterWidth',
        'Controls the width(px) of diff decorations in gutter (added & modified).',
      ),
    },
    'scm.alwaysShowActions': {
      type: 'boolean',
      description: localize(
        'alwaysShowActions',
        'Controls whether inline actions are always visible in the Source Control view.',
      ),
      default: false,
    },
    'scm.defaultViewMode': {
      type: 'string',
      enum: [SCMViewModelMode.Tree, SCMViewModelMode.List],
      description: localize('scm.defaultViewMode', 'Controls the default Source Control repository view mode.'),
      default: SCMViewModelMode.List,
    },
    'scm.listView.compactFolders': {
      type: 'boolean',
      description: localize(
        'scmListViewCompactFolders',
        'Controls whether the source control view should render folders in a compact form. In such a form, single child folders will be compressed in a combined tree element.',
      ),
      default: true,
    },
  },
};

export interface SCMConfiguration {
  'scm.alwaysShowProviders': boolean;
  'scm.providers.visible': number;
  'scm.diffDecorations': string;
  'scm.diffDecorationsGutterWidth': number;
  'scm.alwaysShowActions': boolean;
  'scm.alwaysShowDiffWidget': boolean;
  'scm.defaultViewMode': SCMViewModelMode;
  'scm.listView.compactFolders': boolean;
}

export const SCMPreferences = Symbol('SCMPreferences');
export type SCMPreferences = PreferenceProxy<SCMConfiguration>;

export function bindSCMPreference(injector: Injector) {
  injector.addProviders({
    token: SCMPreferences,
    useFactory: (injector: Injector) => {
      const preferences: PreferenceService = injector.get(PreferenceService);
      return createPreferenceProxy(preferences, scmPreferenceSchema);
    },
  });
}
