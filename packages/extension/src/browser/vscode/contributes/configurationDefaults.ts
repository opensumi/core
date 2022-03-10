import { Injectable, Autowired } from '@opensumi/di';
import {
  PreferenceSchemaProperties,
  OVERRIDE_PROPERTY_PATTERN,
  PreferenceProvider,
  PreferenceScope,
} from '@opensumi/ide-core-browser';

import { VSCodeContributePoint, Contributes } from '../../../common';

export interface ConfigurationSnippets {
  body: {
    title: string;
    properties: any;
  };
}

@Injectable()
@Contributes('configurationDefaults')
export class ConfigurationDefaultsContributionPoint extends VSCodeContributePoint<PreferenceSchemaProperties> {
  @Autowired(PreferenceProvider, { tag: PreferenceScope.Default })
  protected readonly defaultPreferenceProvider: PreferenceProvider;

  contribute() {
    const contributionDefaults = this.json;

    if (contributionDefaults) {
      this.updateDefaultOverridesSchema(contributionDefaults);
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
