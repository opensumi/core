import { Autowired, Injectable } from '@opensumi/di';
import {
  IPreferenceSettingsService,
  ISettingSection,
  PreferenceSchema,
  PreferenceSchemaProperties,
  PreferenceSchemaProvider,
  PreferenceService,
} from '@opensumi/ide-core-browser';
import { LifeCyclePhase } from '@opensumi/ide-core-common';

import { Contributes, LifeCycle, VSCodeContributePoint } from '../../../common';
import { AbstractExtInstanceManagementService } from '../../types';

import { LocalizationsContributionPoint } from './localization';

export interface ConfigurationSnippets {
  body: {
    title: string;
    properties: any;
  };
}

@Injectable()
@Contributes('configuration')
@LifeCycle(LifeCyclePhase.Initialize)
export class ConfigurationContributionPoint extends VSCodeContributePoint<PreferenceSchema[] | PreferenceSchema> {
  @Autowired(PreferenceSchemaProvider)
  protected preferenceSchemaProvider: PreferenceSchemaProvider;

  @Autowired(IPreferenceSettingsService)
  protected preferenceSettingsService: IPreferenceSettingsService;

  @Autowired(PreferenceService)
  protected preferenceService: PreferenceService;

  @Autowired(AbstractExtInstanceManagementService)
  protected readonly extensionManageService: AbstractExtInstanceManagementService;

  @Autowired(LocalizationsContributionPoint)
  protected readonly localizationsContributionPoint: LocalizationsContributionPoint;

  async contribute() {
    await this.localizationsContributionPoint.whenContributed;
    for (const contrib of this.contributesMap) {
      const { extensionId, contributes } = contrib;
      const extension = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
      if (!extension) {
        continue;
      }
      // 一个插件可以注册多个 preference 类别
      let configurations = contributes;
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
              tmpProperties[prop].description = this.getLocalizeFromNlsJSON(
                originalConfiguration.description,
                extensionId,
              );
            }

            if (originalConfiguration.enumDescriptions) {
              tmpProperties[prop].enumDescriptions = originalConfiguration.enumDescriptions.map((v) =>
                this.getLocalizeFromNlsJSON(v, extensionId),
              );
            }

            if (originalConfiguration.markdownDescription) {
              tmpProperties[prop].markdownDescription = this.getLocalizeFromNlsJSON(
                originalConfiguration.markdownDescription,
                extensionId,
              );
            }
          }
          configuration.properties = tmpProperties;
          configuration.title = this.getLocalizeFromNlsJSON(configuration.title, extensionId) || configuration.title;
          this.updateConfigurationSchema(configuration);
          sections.push({
            title: configuration.title,
            extensionId,
            preferences: Object.keys(configuration.properties).map((v) => ({
              id: v,
            })),
          });
        }
      }
      // 如果注册了多个 section, 注册为 subSections
      if (sections.length === 1) {
        const section = sections[0];
        this.addDispose(this.preferenceSettingsService.registerSettingSection('extension', section));
      } else if (sections.length > 1) {
        this.addDispose(
          this.preferenceSettingsService.registerSettingSection('extension', {
            title:
              this.getLocalizeFromNlsJSON(extension.packageJSON.displayName, extensionId) ||
              extension.packageJSON.displayName,
            subSections: sections,
          }),
        );
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
