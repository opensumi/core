import { Injectable, Injector, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import {
  IPreferenceSettingsService,
  PreferenceConfigurations,
  PreferenceProvider,
  PreferenceScope,
} from '@opensumi/ide-core-browser/lib/preferences';

import { IUserStorageService, SettingContribution } from '../common';

import {
  FolderFilePreferenceProvider,
  FolderFilePreferenceProviderFactory,
  FolderFilePreferenceProviderOptions,
} from './folder-file-preference-provider';
import { FoldersPreferencesProvider } from './folders-preferences-provider';
import { PreferenceContribution } from './preference-contribution';
import { PreferenceSettingsService } from './preference-settings.service';
import { UserPreferenceProvider } from './user-preference-provider';
import { UserStorageContribution, UserStorageServiceImpl } from './userstorage';
import {
  WorkspaceFilePreferenceProvider,
  WorkspaceFilePreferenceProviderFactory,
  WorkspaceFilePreferenceProviderOptions,
} from './workspace-file-preference-provider';
import { WorkspacePreferenceProvider } from './workspace-preference-provider';

@Injectable()
export class PreferencesModule extends BrowserModule {
  contributionProvider = SettingContribution;
  providers: Provider[] = [
    ...createPreferenceProviders(),
    {
      token: IUserStorageService,
      useClass: UserStorageServiceImpl,
    },
    {
      token: IPreferenceSettingsService,
      useClass: PreferenceSettingsService,
    },
    PreferenceContribution,
    UserStorageContribution,
  ];

  preferences = injectPreferenceProviders;
}

export function injectFolderPreferenceProvider(inject: Injector): void {
  inject.addProviders({
    token: FolderFilePreferenceProviderFactory,
    useFactory: () => (options: FolderFilePreferenceProviderOptions) => {
      const configurations = inject.get(PreferenceConfigurations);
      const sectionName = configurations.getName(options.configUri);
      const child = inject.createChild(
        [
          {
            token: FolderFilePreferenceProviderOptions,
            useValue: options,
          },
        ],
        {
          dropdownForTag: true,
          tag: sectionName,
        },
      );
      // 当传入为配置文件时，如settings.json, 获取Setting
      if (configurations.isConfigUri(options.configUri)) {
        child.addProviders({
          token: FolderFilePreferenceProvider,
          useClass: FolderFilePreferenceProvider,
        });
        return child.get(FolderFilePreferenceProvider);
      }
      // 当传入为其他文件时，如launch.json
      // 需设置对应的FolderPreferenceProvider 及其对应的 FolderFilePreferenceProviderOptions 依赖
      // 这里的FolderPreferenceProvider获取必须为多例，因为工作区模式下可能存在多个配置文件
      return child.get(FolderFilePreferenceProvider, { tag: sectionName, multiple: true });
    },
  });
}

export function injectWorkspaceFilePreferenceProvider(inject: Injector): void {
  inject.addProviders({
    token: WorkspaceFilePreferenceProviderFactory,
    useFactory: () => (options: WorkspaceFilePreferenceProviderOptions) => {
      const child = inject.createChild([
        {
          token: WorkspaceFilePreferenceProviderOptions,
          useValue: options,
        },
        {
          token: WorkspaceFilePreferenceProvider,
          useClass: WorkspaceFilePreferenceProvider,
        },
      ]);
      return child.get(WorkspaceFilePreferenceProvider);
    },
  });
}

export function injectPreferenceProviders(inject: Injector): void {
  injectFolderPreferenceProvider(inject);
  injectWorkspaceFilePreferenceProvider(inject);
}

export function createPreferenceProviders(): Provider[] {
  return [
    {
      token: PreferenceProvider,
      tag: PreferenceScope.Folder,
      useClass: FoldersPreferencesProvider,
    },
    {
      token: PreferenceProvider,
      tag: PreferenceScope.Workspace,
      useClass: WorkspacePreferenceProvider,
    },
    {
      token: PreferenceProvider,
      tag: PreferenceScope.User,
      useClass: UserPreferenceProvider,
    },
  ];
}
