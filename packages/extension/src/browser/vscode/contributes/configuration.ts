import { Injectable, Autowired } from '@opensumi/di';
import {
  PreferenceSchemaProvider,
  PreferenceSchema,
  PreferenceSchemaProperties,
  IPreferenceSettingsService,
  PreferenceService,
  ISettingSection,
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
    if (!Array.isArray(configurations)) {
      configurations = [configurations];
    }
    const sections = [] as ISettingSection[];

    for (const configuration of configurations) {
      if (configuration && configuration.properties) {
        const tmpProperties = {};
        for (const prop of Object.keys(configuration.properties)) {
          const originalConfiguration = configuration.properties[prop];
          tmpProperties[prop] = originalConfiguration;
          if (originalConfiguration.description) {
            tmpProperties[prop].description = this.getLocalizeFromNlsJSON(originalConfiguration.description);
          }
          if (originalConfiguration.markdownDescription) {
            tmpProperties[prop].markdownDescription = this.getLocalizeFromNlsJSON(
              originalConfiguration.markdownDescription,
            );
          }
        }
        configuration.properties = tmpProperties;
        configuration.title = this.getLocalizeFromNlsJSON(configuration.title) || configuration.title;
        this.updateConfigurationSchema(configuration);
        sections.push({
          title: configuration.title,
          preferences: Object.keys(configuration.properties).map((v) => ({
            id: v,
          })),
        });
      }
    }
    if (sections.length === 1) {
      const section = sections[0];
      this.addDispose(this.preferenceSettingsService.registerSettingSection('extension', section));
    } else if (sections.length > 1) {
      this.addDispose(
        this.preferenceSettingsService.registerSettingSection('extension', {
          title:
            this.getLocalizeFromNlsJSON(this.extension.packageJSON.displayName) ||
            this.extension.packageJSON.displayName,
          subSections: sections,
        }),
      );
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
