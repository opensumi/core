import { Autowired, Injectable } from '@opensumi/di';
import {
  OVERRIDE_PROPERTY_PATTERN,
  PreferenceProvider,
  PreferenceSchemaProperties,
  PreferenceScope,
} from '@opensumi/ide-core-browser';
import { LifeCyclePhase } from '@opensumi/ide-core-common';

import { Contributes, LifeCycle, VSCodeContributePoint } from '../../../common';

export interface ConfigurationSnippets {
  body: {
    title: string;
    properties: any;
  };
}

@Injectable()
@Contributes('configurationDefaults')
@LifeCycle(LifeCyclePhase.Starting)
export class ConfigurationDefaultsContributionPoint extends VSCodeContributePoint<PreferenceSchemaProperties> {
  @Autowired(PreferenceProvider, { tag: PreferenceScope.Default })
  protected readonly defaultPreferenceProvider: PreferenceProvider;

  contribute() {
    for (const contrib of this.contributesMap) {
      const { contributes } = contrib;
      if (contributes) {
        this.updateDefaultOverridesSchema(contributes);
      }
    }
  }

  protected updateDefaultOverridesSchema(configurationDefaults: PreferenceSchemaProperties): void {
    // eslint-disable-next-line guard-for-in
    for (const key in configurationDefaults) {
      const defaultValue = configurationDefaults[key];
      if (OVERRIDE_PROPERTY_PATTERN.test(key)) {
        const language = key.match(OVERRIDE_PROPERTY_PATTERN)![1];
        Object.keys(defaultValue).forEach((preferenceName) => {
          this.defaultPreferenceProvider.setPreference(
            preferenceName,
            defaultValue[preferenceName],
            undefined,
            language,
          );
        });
      }
    }
  }
}
