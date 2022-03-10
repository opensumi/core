import { Injectable, Autowired, Injector } from '@opensumi/di';
import { URI, createContributionProvider } from '@opensumi/ide-core-common';
import { ContributionProvider, DEFAULT_WORKSPACE_STORAGE_DIR_NAME } from '@opensumi/ide-core-common';

import { AppConfig } from '../react-providers';

export const PreferenceConfiguration = Symbol('PreferenceConfiguration');

export interface PreferenceConfiguration {
  name: string;
}

export function injectPreferenceConfigurations(injector: Injector): void {
  createContributionProvider(injector, PreferenceConfiguration);
  injector.addProviders({
    token: PreferenceConfigurations,
    useClass: PreferenceConfigurations,
  });
}

@Injectable()
export class PreferenceConfigurations {
  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(PreferenceConfiguration)
  private readonly preferenceConfigurationProvider: ContributionProvider<PreferenceConfiguration>;

  getPaths(): string[] {
    if (this.appConfig.workspacePreferenceDirName) {
      return [this.appConfig.workspacePreferenceDirName];
    } else if (this.appConfig.preferenceDirName) {
      return [this.appConfig.preferenceDirName];
    }
    return [DEFAULT_WORKSPACE_STORAGE_DIR_NAME];
  }

  public getConfigName(): string {
    return 'settings';
  }

  protected sectionNames: string[] | undefined;
  public getSectionNames(): string[] {
    if (!this.sectionNames) {
      this.sectionNames = this.preferenceConfigurationProvider.getContributions().map((p) => p.name);
    }
    return this.sectionNames;
  }

  public isSectionName(name: string): boolean {
    return this.getSectionNames().indexOf(name) !== -1;
  }

  public isSectionUri(configUri: URI | undefined): boolean {
    return !!configUri && this.isSectionName(this.getName(configUri));
  }

  public isConfigUri(configUri: URI | undefined): boolean {
    return !!configUri && this.getName(configUri) === this.getConfigName();
  }

  public getName(configUri: URI): string {
    return configUri.path.name;
  }

  public getPath(configUri: URI): string {
    return configUri.parent.path.base;
  }

  public createUri(
    folder: URI,
    configPath: string = this.getPaths()[0],
    configName: string = this.getConfigName(),
  ): URI {
    return folder.resolve(configPath).resolve(configName + '.json');
  }
}
