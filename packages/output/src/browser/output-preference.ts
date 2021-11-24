import { Injector } from '@opensumi/di';
import { PreferenceService, PreferenceProxy, createPreferenceProxy, PreferenceSchema, localize } from '@opensumi/ide-core-browser';

// output 相关配置项注册
/* istanbul ignore file */
export const outputPreferenceSchema: PreferenceSchema = {
  id: 'output',
  order: 7,
  title: localize('output.configurationTitle'),
  type: 'object',
  properties: {
    'output.logWhenNoPanel': {
      type: 'boolean',
      description: localize('output.logWhenNoPanel'),
      default: true,
    },
  },
};

export interface OutputConfiguration {
  'output.logWhenNoPanel': boolean;
}

export const OutputPreferences = Symbol('OutputPreferences');
export type OutputPreferences = PreferenceProxy<OutputConfiguration>;

export function bindOutputPreference(injector: Injector) {
  injector.addProviders({
    token: OutputPreferences,
    useFactory: (injector: Injector) => {
      const preferences: PreferenceService = injector.get(PreferenceService);
      return createPreferenceProxy(preferences, outputPreferenceSchema);
    },
  });
}
