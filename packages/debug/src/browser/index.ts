import { Injectable, Injector, Provider } from '@opensumi/di';
import { BrowserModule, IContextKeyService } from '@opensumi/ide-core-browser';
import { FolderFilePreferenceProvider } from '@opensumi/ide-preferences/lib/browser/folder-file-preference-provider';

import {
  DebugEditor,
  DebugModelFactory,
  IDebugConsoleModelService,
  IDebugModelManager,
  IDebugProgress,
  IDebugService,
  IDebugSessionManager,
  ILaunchService,
} from '../common';

import { BreakpointManager } from './breakpoint';
import { DebugCallStackItemTypeKey } from './contextkeys';
import { DebugConfigurationManager } from './debug-configuration-manager';
import { DebugContribution } from './debug-contribution';
import { injectDebugPreferences } from './debug-preferences';
import { DebugProgressService } from './debug-progress.service';
import { DebugService } from './debug-service';
import {
  DebugSessionContribution,
  DebugSessionContributionRegistry,
  DebugSessionContributionRegistryImpl,
} from './debug-session-contribution';
import { DebugSessionManager } from './debug-session-manager';
import { DebugExpressionProvider, DebugModel, DebugModelManager } from './editor';
import { DebugHoverSource } from './editor/debug-hover-source';
import { EvaluatableExpressionServiceImpl, IEvaluatableExpressionService } from './editor/evaluatable-expression';
import { LaunchFolderPreferenceProvider } from './preferences/launch-folder-preference-provider';
import { LaunchPreferencesContribution } from './preferences/launch-preferences-contribution';
import { LaunchService } from './preferences/launch.service';
import { DebugToolbarOverlayWidget } from './view/configuration/debug-toolbar.view';
import { DebugConsoleModelService } from './view/console/debug-console-tree.model.service';
import { DebugConsoleContribution } from './view/console/debug-console.contribution';
import { DebugCallStackContribution } from './view/frames/debug-call-stack.contribution';
import { VariablesPanelContribution } from './view/variables/debug-variables.contribution';
import { WatchPanelContribution } from './view/watch/debug-watch.contribution';

import './debug-style.less';

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
      token: IDebugModelManager,
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
      token: IEvaluatableExpressionService,
      useClass: EvaluatableExpressionServiceImpl,
    },
    {
      token: FolderFilePreferenceProvider,
      useClass: LaunchFolderPreferenceProvider,
      dropdownForTag: true,
      tag: 'launch',
    },
    {
      token: DebugModelFactory,
      useFactory: (injector: Injector) => (editor: DebugEditor) => DebugModel.createModel(injector, editor),
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
      token: ILaunchService,
      useClass: LaunchService,
    },
    {
      token: IDebugProgress,
      useClass: DebugProgressService,
    },
    {
      token: IDebugConsoleModelService,
      useClass: DebugConsoleModelService,
    },
    // contributions
    LaunchPreferencesContribution,
    DebugContribution,
    DebugConsoleContribution,
    VariablesPanelContribution,
    DebugCallStackContribution,
    WatchPanelContribution,
    // contextkeys
    {
      token: DebugCallStackItemTypeKey,
      useFactory: (injector: Injector) => injector.get(IContextKeyService).createKey('callStackItemType'),
    },
  ];

  contributionProvider = DebugSessionContribution;

  preferences = injectDebugPreferences;

  isOverlay = true;
  component = DebugToolbarOverlayWidget;
}
