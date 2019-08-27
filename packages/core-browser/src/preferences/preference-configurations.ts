import { Injectable, Autowired, Injector } from '@ali/common-di';
import { URI, createContributionProvider } from '@ali/ide-core-common';
import { ContributionProvider } from '@ali/ide-core-common';

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

export const WORKSPACE_FOLDER_NAME = '.kaitian';
@Injectable()
export class PreferenceConfigurations {

    @Autowired(PreferenceConfiguration)
    private readonly preferenceConfigurationProvider: ContributionProvider<PreferenceConfiguration>;

    getPaths(): string[] {
        return [WORKSPACE_FOLDER_NAME, '.vscode'];
    }

    getConfigName(): string {
        return 'settings';
    }

    protected sectionNames: string[] | undefined;
    getSectionNames(): string[] {
        if (!this.sectionNames) {
            this.sectionNames = this.preferenceConfigurationProvider.getContributions().map((p) => p.name);
        }
        return this.sectionNames;
    }

    isSectionName(name: string): boolean {
        return this.getSectionNames().indexOf(name) !== -1;
    }

    isSectionUri(configUri: URI | undefined): boolean {
        return !!configUri && this.isSectionName(this.getName(configUri));
    }

    isConfigUri(configUri: URI | undefined): boolean {
        return !!configUri && this.getName(configUri) === this.getConfigName();
    }

    getName(configUri: URI): string {
        return configUri.path.name;
    }

    getPath(configUri: URI): string {
        return configUri.parent.path.base;
    }

    createUri(folder: URI, configPath: string = this.getPaths()[0], configName: string = this.getConfigName()): URI {
      return folder.resolve(configPath).resolve(configName + '.json');
    }

}

export const PreferenceProviderTagetMap = new Map<string, any>();
