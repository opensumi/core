import * as React from 'react';
import { Provider, Injectable, Injector } from '@ali/common-di';
import { BrowserModule, IContextKeyService } from '@ali/ide-core-browser';
import { injectDebugPreferences } from './debug-preferences';
import { DebugResourceResolverContribution } from './debug-resource';
import { DebugContribution } from './debug-contribution';
import { DebugServerPath, IDebugService, IDebugServer, DebugEditor, IDebugSessionManager, DebugModelFactory } from '../common';
import { DebugConfigurationManager } from './debug-configuration-manager';
import { DebugSessionFactory, DefaultDebugSessionFactory, DebugSessionContributionRegistry, DebugSessionContributionRegistryImpl, DebugSessionContribution } from './debug-session-contribution';
import { DebugSessionManager } from './debug-session-manager';
import { LaunchPreferencesContribution } from './preferences/launch-preferences-contribution';
import { FolderPreferenceProvider } from '@ali/ide-preferences/lib/browser/folder-preference-provider';
import { LaunchFolderPreferenceProvider } from './preferences/launch-folder-preference-provider';
import { DebugCallStackItemTypeKey } from './contextkeys/debug-call-stack-item-type-key';
import { DebugService } from './debug-service';
import { DebugModel, DebugModelManager, DebugExpressionProvider } from './editor';
import { DebugHoverSource } from './editor/debug-hover-source';
import { DebugConsoleContribution } from './console/debug-console.contribution';
import { DebugConsoleSession } from './console/debug-console-session';
import { BreakpointManager } from './breakpoint';

@Injectable()
export class DebugModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: DebugHoverSource,
      useClass: DebugHoverSource,
    },
    {
      token: DebugExpressionProvider,
      useClass: DebugExpressionProvider,
    },
    {
      token: DebugSessionFactory,
      useClass: DefaultDebugSessionFactory,
    },
    {
      token: DebugModelManager,
      useClass: DebugModelManager,
    },
    {
      token: IDebugSessionManager,
      useClass: DebugSessionManager,
    },
    {
      token: BreakpointManager,
      useClass: BreakpointManager,
    },
    {
      token: DebugConfigurationManager,
      useClass: DebugConfigurationManager,
    },
    {
      token: FolderPreferenceProvider,
      useClass: LaunchFolderPreferenceProvider,
      dropdownForTag: true,
      tag: 'launch',
    },
    {
      token: DebugModelFactory,
      useFactory: (injector: Injector) => (editor: DebugEditor) => {
        return DebugModel.createModel(injector, editor);
      },
    },
    {
      token: DebugSessionContributionRegistry,
      useClass: DebugSessionContributionRegistryImpl,
    },
    {
      token: IDebugService,
      useClass: DebugService,
    },
    {
      token: IDebugServer,
      useFactory: (injector: Injector) => {
        injector.get(DebugServerPath);
      },
    },
    {
      token: DebugConsoleSession,
      useClass: DebugConsoleSession,
    },
    // contributions
    LaunchPreferencesContribution,
    DebugResourceResolverContribution,
    DebugContribution,
    DebugConsoleContribution,
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
    servicePath: DebugServerPath,
  }];
}

export * from './breakpoint';
export * from './contextkeys';
export * from './markers';
export * from './model';
export * from './debug-preferences';
export * from './debug-configuration-manager';
export * from './debug-configuration-model';
export * from './debug-contribution';
export * from './debug-session-manager';
export * from './debug-session-manager';
export * from './debug-resource';
export * from './debug-schema-updater';
export * from './debug-session';
export * from './debug-session-connection';
export * from './debug-session-contribution';
export * from './editor/debug-model-manager';
