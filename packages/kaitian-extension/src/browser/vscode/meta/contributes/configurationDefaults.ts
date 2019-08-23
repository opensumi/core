import { VSCodeContributePoint, Contributes } from '../../../../common';
import { Injectable, Autowired } from '@ali/common-di';
import { PreferenceSchemaProvider, PreferenceSchema, PreferenceSchemaProperties } from '@ali/ide-core-browser';

export interface ConfigurationSnippets {
  body: {
    title: string,
    properties: any,
  };
}

@Injectable()
@Contributes('configurationDefaults')
export class ConfigurationDefaultsContributionPoint extends VSCodeContributePoint<PreferenceSchemaProperties> {

  @Autowired(PreferenceSchemaProvider)
  preferenceSchemaProvider: PreferenceSchemaProvider;

  contribute() {
    const contributionDefaults = this.json;

    if (contributionDefaults) {
      this.updateDefaultOverridesSchema(contributionDefaults);
    }
  }

  protected updateDefaultOverridesSchema(configurationDefaults: PreferenceSchemaProperties): void {
    const defaultOverrides: PreferenceSchema = {
        id: 'defaultOverrides',
        title: 'Default Configuration Overrides',
        properties: {},
    };
    // tslint:disable-next-line:forin
    for (const key in configurationDefaults) {
        const defaultValue = configurationDefaults[key];
        if (this.preferenceSchemaProvider.testOverrideValue(key, defaultValue)) {
            defaultOverrides.properties[key] = {
                type: 'object',
                default: defaultValue,
                description: `Configure editor settings to be overridden for ${key} language.`,
            };
        }
    }
    if (Object.keys(defaultOverrides.properties).length) {
        this.preferenceSchemaProvider.setSchema(defaultOverrides);
    }
  }

}
