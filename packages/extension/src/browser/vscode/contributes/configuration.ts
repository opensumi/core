import { Injectable, Autowired } from '@opensumi/di';
import {
  replaceLocalizePlaceholder,
  PreferenceSchemaProvider,
  PreferenceSchema,
  PreferenceSchemaProperties,
  IPreferenceSettingsService,
  PreferenceService,
} from '@opensumi/ide-core-browser';

import { VSCodeContributePoint, Contributes } from '../../../common';

export interface ConfigurationSnippets {
  body: {
    title: string;
    properties: any;
  };
}

@Injectable()
@Contributes('configuration')
export class ConfigurationContributionPoint extends VSCodeContributePoint<PreferenceSchema[] | PreferenceSchema> {
  @Autowired(PreferenceSchemaProvider)
  protected preferenceSchemaProvider: PreferenceSchemaProvider;

  @Autowired(IPreferenceSettingsService)
  protected preferenceSettingsService: IPreferenceSettingsService;

  @Autowired(PreferenceService)
  protected preferenceService: PreferenceService;

  contribute() {
    let configurations = this.json;
    let properties = {};
    if (!Array.isArray(configurations)) {
      configurations = [configurations];
    }
    for (const configuration of configurations) {
      if (configuration && configuration.properties) {
        for (const prop of Object.keys(configuration.properties)) {
          properties[prop] = configuration.properties[prop];
          if (configuration.properties[prop].description) {
            properties[prop].description = replaceLocalizePlaceholder(
              configuration.properties[prop].description,
              this.extension.id,
            );
          }
        }
        configuration.properties = properties;
        configuration.title =
          replaceLocalizePlaceholder(configuration.title, this.extension.id) || this.extension.packageJSON.name;
        this.updateConfigurationSchema(configuration);
        this.addDispose(
          this.preferenceSettingsService.registerSettingSection('extension', {
            title: configuration.title,
            preferences: Object.keys(configuration.properties),
          }),
        );
        properties = {};
      }
    }
  }

  private updateConfigurationSchema(schema: PreferenceSchema): void {
    this.validateConfigurationSchema(schema);

    this.addDispose(this.preferenceSchemaProvider.setSchema(schema));
  }

  protected validateConfigurationSchema(schema: PreferenceSchema): void {
    // eslint-disable-next-line guard-for-in
    for (const p in schema.properties) {
      const property = schema.properties[p];
      if (property.type === 'string[]') {
        property.type = 'array';
      }
      if (property.type !== 'object') {
        continue;
      }
      if (typeof property.default === 'undefined') {
        this.validateDefaultValue(property);
      }

      const properties = property.properties;
      if (properties) {
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
      for (const key in properties) {
        if (properties[key].default) {
          property.default[key] = properties[key].default;
          delete properties[key].default;
        }
      }
    }
  }
}
