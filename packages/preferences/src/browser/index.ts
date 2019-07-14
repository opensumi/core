import * as React from 'react';
import { Provider, Injector } from '@ali/common-di';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';
import { HelloWorld } from './preferences.view';
import { PreferenceContribution } from './preference-contribution';
import { FoldersPreferencesProvider } from './folders-preferences-provider';
import { WorkspacePreferenceProvider } from './workspace-preference-provider';
import { UserPreferenceProvider } from './user-preference-provider';
import { preferenceScopeProviderTokenMap, PreferenceScope, PreferenceProvider, PreferenceConfigurations } from '@ali/ide-core-browser/lib/preferences';
import { FolderPreferenceProviderFactory, SettingsFolderPreferenceProviderOptions, SettingsFolderPreferenceProvider } from './folder-preference-provider';
import { WorkspaceFilePreferenceProviderFactory, WorkspaceFilePreferenceProviderOptions, WorkspaceFilePreferenceProvider } from './workspace-file-preference-provider';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class PreferencesModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: preferenceScopeProviderTokenMap[PreferenceScope.Folder],
      useClass: FoldersPreferencesProvider,
    },
    {
      token: preferenceScopeProviderTokenMap[PreferenceScope.Workspace],
      useClass: WorkspacePreferenceProvider,
    },
    {
      token: preferenceScopeProviderTokenMap[PreferenceScope.User],
      useClass: UserPreferenceProvider,
    },
    PreferenceContribution,
  ];

  preferences = injectPreferenceProviders;

  component = HelloWorld;
}

export function injectFolderPreferenceProvider(inject: Injector): void {
  inject.addProviders({
    token: FolderPreferenceProviderFactory,
    useFactory: () => {
      return (options: SettingsFolderPreferenceProviderOptions) => {
        inject.addProviders({
          token: SettingsFolderPreferenceProviderOptions,
          useValue: options,
        });
        const configurations = inject.get(PreferenceConfigurations);
        // 当传入为配置文件时，如settings.json, 获取Setting
        if (configurations.isConfigUri(options.configUri)) {
          inject.addProviders({
            token: SettingsFolderPreferenceProvider,
            useClass: SettingsFolderPreferenceProvider,
          });
          return inject.get(SettingsFolderPreferenceProvider);
        }
        // 当传入为其他文件时，如launch.json
        // 需设置对应的FolderPreferenceProvider 及其对应的 FolderPreferenceProviderOptions 依赖
      };
    },
  });
}

export function injectWorkspaceFilePreferenceProvider(inject: Injector): void {
  inject.addProviders({
    token: WorkspaceFilePreferenceProviderFactory,
    useFactory: () => {
      return (options: WorkspaceFilePreferenceProviderOptions) => {
        inject.addProviders({
          token: WorkspaceFilePreferenceProviderOptions,
          useValue: options,
        });
        inject.addProviders({
          token: WorkspaceFilePreferenceProvider,
          useClass: WorkspaceFilePreferenceProvider,
        });
        return inject.get(WorkspaceFilePreferenceProvider);
      };
    },
  });
}

export function injectPreferenceProviders(inject: Injector): void {
  injectFolderPreferenceProvider(inject);
  injectWorkspaceFilePreferenceProvider(inject);
}
