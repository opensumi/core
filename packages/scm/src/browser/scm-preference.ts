import { Injector } from '@ali/common-di';
import { PreferenceService, PreferenceProxy, createPreferenceProxy, PreferenceSchema, localize } from '@ali/ide-core-browser';

export const scmPreferenceSchema: PreferenceSchema = {
  id: 'scm',
  order: 5,
  title: localize('scmConfigurationTitle', 'SCM'),
  type: 'object',
  properties: {
    'scm.alwaysShowProviders': {
      type: 'boolean',
      description: localize('alwaysShowProviders', 'Controls whether to always show the Source Control Provider section.'),
      default: false,
    },
    'scm.providers.visible': {
      type: 'number',
      description: localize('providersVisible', 'Controls how many providers are visible in the Source Control Provider section. Set to `0` to be able to manually resize the view.'),
      default: 10,
    },
    'scm.diffDecorations': {
      type: 'string',
      enum: ['all', 'gutter', 'overview', 'none'],
      default: 'all',
      description: localize('diffDecorations', 'Controls diff decorations in the editor.'),
    },
    'scm.diffDecorationsGutterWidth': {
      type: 'number',
      enum: [1, 2, 3, 4, 5],
      default: 3,
      description: localize('diffGutterWidth', 'Controls the width(px) of diff decorations in gutter (added & modified).'),
    },
    'scm.alwaysShowActions': {
      type: 'boolean',
      description: localize('alwaysShowActions', 'Controls whether inline actions are always visible in the Source Control view.'),
      default: false,
    },
  },
};

export interface SCMConfiguration {
  'scm.alwaysShowProviders': boolean;
  'scm.providers.visible': number;
  'scm.diffDecorations': string;
  'scm.diffDecorationsGutterWidth': number;
  'scm.alwaysShowActions': boolean;
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
