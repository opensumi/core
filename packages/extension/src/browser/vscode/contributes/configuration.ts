import { Injectable, Autowired } from '@opensumi/di';
import {
  replaceLocalizePlaceholder,
  PreferenceSchemaProvider,
  PreferenceSchema,
  PreferenceSchemaProperties,
  IPreferenceSettingsService,
  PreferenceService,
} from '@opensumi/ide-core-browser';
import { LifeCyclePhase } from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';
import { AbstractExtInstanceManagementService } from '../../types';

export interface ConfigurationSnippets {
  body: {
    title: string;
    properties: any;
  };
}

@Injectable()
@Contributes('configuration')
@LifeCycle(LifeCyclePhase.Starting)
export class ConfigurationContributionPoint extends VSCodeContributePoint<PreferenceSchema[] | PreferenceSchema> {
  @Autowired(PreferenceSchemaProvider)
  protected preferenceSchemaProvider: PreferenceSchemaProvider;

  @Autowired(IPreferenceSettingsService)
  protected preferenceSettingsService: IPreferenceSettingsService;

  @Autowired(PreferenceService)
  protected preferenceService: PreferenceService;

  @Autowired(AbstractExtInstanceManagementService)
  protected readonly extensionManageService: AbstractExtInstanceManagementService;

  contribute() {
    for (const contrib of this.contributesMap) {
      const { extensionId, contributes } = contrib;
      const extension = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
      if (!extension) {
        continue;
      }
      let configurations = contributes;
      // 当前函数里只创建声明这一次变量，然后后面给这个函数赋值
      let tmpProperties = {};
      if (!Array.isArray(configurations)) {
        configurations = [configurations];
      }
      for (const configuration of configurations) {
        if (configuration && configuration.properties) {
          for (const prop of Object.keys(configuration.properties)) {
            const originalConfiguration = configuration.properties[prop];
            tmpProperties[prop] = originalConfiguration;
            if (originalConfiguration.description) {
              tmpProperties[prop].description = replaceLocalizePlaceholder(
                originalConfiguration.description,
                extensionId,
              );
            }

            if (originalConfiguration.enumDescriptions) {
              tmpProperties[prop].enumDescriptions = originalConfiguration.enumDescriptions.map((v) =>
                replaceLocalizePlaceholder(v, extensionId),
              );
            }

            if (originalConfiguration.markdownDescription) {
              tmpProperties[prop].markdownDescription = replaceLocalizePlaceholder(
                originalConfiguration.markdownDescription,
                extensionId,
              );
            }
          }
          configuration.properties = tmpProperties;
          configuration.title =
            replaceLocalizePlaceholder(configuration.title, extensionId) || extension.packageJSON.name;
          this.updateConfigurationSchema(configuration);
          this.addDispose(
            this.preferenceSettingsService.registerSettingSection('extension', {
              title: configuration.title,
              preferences: Object.keys(configuration.properties),
            }),
          );
          tmpProperties = {};
        }
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
