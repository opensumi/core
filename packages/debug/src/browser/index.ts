import { Injectable, Injector, Provider } from '@ali/common-di';
import { BrowserModule, IContextKeyService } from '@ali/ide-core-browser';
import { FolderPreferenceProvider } from '@ali/ide-preferences/lib/browser/folder-preference-provider';

import { DebugEditor, DebugModelFactory, DebugServerPath, IDebugServer, IDebugService, IDebugSessionManager } from '../common';
import { BreakpointManager } from './breakpoint';
import { BreakpointWidgetInputFocus, DebugCallStackItemTypeKey } from './contextkeys';
import { DebugConfigurationManager } from './debug-configuration-manager';
import { DebugContribution } from './debug-contribution';
import { injectDebugPreferences } from './debug-preferences';
import { DebugResourceResolverContribution } from './debug-resource';
import { DebugService } from './debug-service';
import { DebugSessionContribution, DebugSessionContributionRegistry, DebugSessionContributionRegistryImpl, DebugSessionFactory, DefaultDebugSessionFactory } from './debug-session-contribution';
import { DebugSessionManager } from './debug-session-manager';
import { DebugExpressionProvider, DebugModel, DebugModelManager } from './editor';
import { DebugHoverSource } from './editor/debug-hover-source';
import { LaunchFolderPreferenceProvider } from './preferences/launch-folder-preference-provider';
import { LaunchPreferencesContribution } from './preferences/launch-preferences-contribution';
import { DebugToolbarOverlayWidget } from './view/configuration/debug-toolbar.view';
import { VariablesPanelContribution } from './view/variables/debug-variables.contribution';
import { DebugConsoleContribution } from './view/console/debug-console.contribution';
import { WatchPanelContribution } from './view/watch/debug-watch.contribution';

import './debug-style.less';
import { DebugWatch } from './model';

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
      token: DebugWatch,
      useClass: DebugWatch,
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
    // contributions
    LaunchPreferencesContribution,
    DebugResourceResolverContribution,
    DebugContribution,
    DebugConsoleContribution,
    VariablesPanelContribution,
    WatchPanelContribution,
    // contextkeys
    {
      token: DebugCallStackItemTypeKey,
      useFactory: (injector: Injector) => {
        return injector.get(IContextKeyService).createKey('callStackItemType');
      },
    },
    {
      token: BreakpointWidgetInputFocus,
      useFactory: (injector: Injector) => {
        return injector.get(IContextKeyService).createKey('breakpointWidgetInputFocus', false);
      },
    },
  ];

  contributionProvider = DebugSessionContribution;

  preferences = injectDebugPreferences;

  backServices = [{
    servicePath: DebugServerPath,
  }];

  isOverlay = true;
  component = DebugToolbarOverlayWidget;
}

export * from './breakpoint';
export * from './contextkeys';
export * from './debug-configuration-manager';
export * from './debug-configuration-model';
export * from './debug-contribution';
export * from './debug-preferences';
export * from './debug-resource';
export * from './debug-schema-updater';
export * from './debug-session';
export * from './debug-session-connection';
export * from './debug-session-contribution';
export * from './debug-session-manager';
export * from './editor/debug-model-manager';
export * from './markers';
export * from './model';
