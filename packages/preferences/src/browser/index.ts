import { Provider, Injector, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import {
  PreferenceScope,
  PreferenceConfigurations,
  PreferenceProvider,
  IPreferenceSettingsService,
} from '@opensumi/ide-core-browser/lib/preferences';

import { IUserStorageService, SettingContribution } from '../common';

import {
  FolderPreferenceProviderFactory,
  FolderPreferenceProviderOptions,
  FolderPreferenceProvider,
} from './folder-preference-provider';
import { FoldersPreferencesProvider } from './folders-preferences-provider';
import { PreferenceContribution } from './preference-contribution';
import { PreferenceSettingsService } from './preference-settings.service';
import { UserPreferenceProvider } from './user-preference-provider';
import { UserStorageContribution, UserStorageServiceImpl } from './userstorage';
import {
  WorkspaceFilePreferenceProviderFactory,
  WorkspaceFilePreferenceProviderOptions,
  WorkspaceFilePreferenceProvider,
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
    token: FolderPreferenceProviderFactory,
    useFactory: () => (options: FolderPreferenceProviderOptions) => {
      const configurations = inject.get(PreferenceConfigurations);
      const sectionName = configurations.getName(options.configUri);
      const child = inject.createChild(
        [
          {
            token: FolderPreferenceProviderOptions,
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
          token: FolderPreferenceProvider,
          useClass: FolderPreferenceProvider,
        });
        return child.get(FolderPreferenceProvider);
      }
      // 当传入为其他文件时，如launch.json
      // 需设置对应的FolderPreferenceProvider 及其对应的 FolderPreferenceProviderOptions 依赖
      // 这里的FolderPreferenceProvider获取必须为多例，因为工作区模式下可能存在多个配置文件
      return child.get(FolderPreferenceProvider, { tag: sectionName, multiple: true });
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
