import * as React from 'react';
import { Provider, Injectable, Injector } from '@ali/common-di';
import { BrowserModule, IContextKeyService } from '@ali/ide-core-browser';
import { injectDebugPreferences } from './debug-preferences';
import { DebugResourceResolverContribution } from './debug-resource';
import { DebugContribution } from './debug-contribution';
import { DebugService, DebugServicePath } from '../common';
import { DebugConfigurationManager } from './debug-configuration-manager';
import { DebugSessionFactory, DefaultDebugSessionFactory, DebugSessionContributionRegistry, DebugSessionContributionRegistryImpl, DebugSessionContribution } from './debug-session-contribution';
import { DebugSessionManager } from './debug-session-manager';
import { LaunchPreferencesContribution } from './preferences/launch-preferences-contribution';
import { FolderPreferenceProvider } from '@ali/ide-preferences/lib/browser/folder-preference-provider';
import { LaunchFolderPreferenceProvider } from './preferences/launch-folder-preference-provider';
import { DebugCallStackItemTypeKey } from './contextkeys/debug-call-stack-item-type-key';

@Injectable()
export class DebugModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: DebugSessionFactory,
      useClass: DefaultDebugSessionFactory,
    },
    {
      token: DebugSessionManager,
      useClass: DebugSessionManager,
    },
    {
      token: DebugConfigurationManager,
      useClass: DebugConfigurationManager,
    },
    {
      token: FolderPreferenceProvider,
      useClass: LaunchFolderPreferenceProvider,
      tag: 'launch',
    },
    {
      token: DebugSessionContributionRegistry,
      useClass: DebugSessionContributionRegistryImpl,
    },
    // contributions
    LaunchPreferencesContribution,
    DebugResourceResolverContribution,
    DebugContribution,
    // contextkeys
    {
      token: DebugCallStackItemTypeKey,
      useFactory: (injector: Injector) => {
        return injector.get(IContextKeyService).createKey('callStackItemType');
      },
    },
  ];

  contributionProvider = DebugSessionContribution;

  preferences = injectDebugPreferences;

  backServices = [{
    servicePath: DebugServicePath,
  }];
}
