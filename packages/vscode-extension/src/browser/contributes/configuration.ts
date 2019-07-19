import { VscodeContributionPoint, replaceLocalizePlaceholder, Contributes } from './common';
import { Injectable, Autowired } from '@ali/common-di';
import { CommandRegistry, CommandService, ILogger, PreferenceSchemaProvider, PreferenceSchema, PreferenceSchemaProperties } from '@ali/ide-core-browser';
import { ExtHostAPIIdentifier } from '../../common';
import { VSCodeExtensionService } from '../types';

export interface ConfigurationSnippets {
  body: {
    title: string,
    properties: any,
  };
}

export interface ConfigurationFormat {

  defaultSnippets: ConfigurationSnippets[];

  title: string;

  properties: {
    [key: string]: {
      default?: any,
      description?: string
      type: string | string[],
    },
  };

}

export type ConfigurationsSchema = Array<ConfigurationFormat>;

@Injectable()
@Contributes('configuration')
export class ConfigurationContributionPoint extends VscodeContributionPoint<ConfigurationsSchema> {

  @Autowired(PreferenceSchemaProvider)
  preferenceSchemaProvider: PreferenceSchemaProvider;

  @Autowired(VSCodeExtensionService)
  vscodeExtensionService: VSCodeExtensionService;

  @Autowired(ILogger)
  logger: ILogger;

  contribute() {
    const contributions = this.contributes;
    const properties = {};
    // tslint:disable-next-line: forin
    for (const prop in contributions.configuration.properties) {
      properties[prop] = contributions.configuration.properties[prop];
      if (contributions.configuration.properties[prop].description) {
        properties[prop].description = replaceLocalizePlaceholder(contributions.configuration.properties[prop].description);
      }
    }
    contributions.configuration.properties = properties;
    if (contributions.configuration) {
      this.updateConfigurationSchema(contributions.configuration);
    }
    if (contributions.configurationDefaults) {
      this.updateDefaultOverridesSchema(contributions.configurationDefaults);
    }
  }

  private updateConfigurationSchema(schema: PreferenceSchema): void {
    this.validateConfigurationSchema(schema);
    this.preferenceSchemaProvider.setSchema(schema);
  }

  protected validateConfigurationSchema(schema: PreferenceSchema): void {
    // tslint:disable-next-line:forin
    for (const p in schema.properties) {
      const property = schema.properties[p];
      if (property.type !== 'object') {
        continue;
      }

      if (!property.default) {
        this.validateDefaultValue(property);
      }

      const properties = property.properties;
      if (properties) {
        // tslint:disable-next-line:forin
        for (const key in properties) {
          if (typeof properties[key] !== 'object') {
            delete properties[key];
          }
        }
      }
    }
  }

  private validateDefaultValue(property: PreferenceSchemaProperties): void {
    property.default = {};

    const properties = property.properties;
    if (properties) {
      // tslint:disable-next-line:forin
      for (const key in properties) {
        if (properties[key].default) {
          property.default[key] = properties[key].default;
          delete properties[key].default;
        }
      }
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
