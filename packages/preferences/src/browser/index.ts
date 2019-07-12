import * as React from 'react';
import { Provider } from '@ali/common-di';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';
import { HelloWorld } from './preferences.view';
import { PreferenceContribution } from './preference-contribution';
import { FoldersPreferencesProvider } from './folders-preferences-provider';
import { WorkspacePreferenceProvider } from './workspace-preference-provider';
import { UserPreferenceProvider } from './user-preference-provider';
import { preferenceScopeProviderTokenMap, PreferenceScope } from '@ali/ide-core-browser/lib/preferences';
const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class PreferencesModule extends BrowserModule {
  providers: Provider[] = [
    PreferenceContribution,
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
  ];

  component = HelloWorld;
}
