import { Injector, Provider } from '@opensumi/di';
import {
  AppLifeCycleServiceToken,
  CommandContribution,
  CommandRegistry,
  CommandRegistryImpl,
  CommandService,
  CommandServiceImpl,
  DefaultReporter,
  EventBusImpl,
  IAIReporter,
  IApplicationService,
  IAuthenticationService,
  IEventBus,
  IExtensionsSchemaService,
  IProblemMatcherRegistry,
  IProblemPatternRegistry,
  IReporter,
  IReporterService,
  ITaskDefinitionRegistry,
  ProblemMatchersRegistryImpl,
  ProblemPatternRegistryImpl,
  REPORT_HOST,
  ReporterMetadata,
  ReporterService,
  TaskDefinitionRegistryImpl,
  createContributionProvider,
} from '@opensumi/ide-core-common';
import {
  HashCalculateServiceImpl,
  IHashCalculateService,
} from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';
import {
  KeyboardLayoutChangeNotifierService,
  KeyboardNativeLayoutService,
} from '@opensumi/ide-core-common/lib/keyboard/keyboard-layout-provider';

import { AIReporter } from '../ai-native/ai-reporter';
import { ClientAppStateService } from '../application/application-state-service';
import { ApplicationService } from '../application/application.service';
import { ConnectionHelperFactory } from '../application/runtime';
import { AuthenticationService } from '../authentication/authentication.service';
import { ClientAppContribution } from '../common';
import { ISplitPanelService, SplitPanelService } from '../components/layout/split-panel.service';
import { DesignStyleService, IDesignStyleService } from '../design';
import { ExtensionsPointServiceImpl } from '../extensions';
import { FsProviderContribution } from '../fs';
import { KeybindingContribution, KeybindingRegistry, KeybindingRegistryImpl, KeybindingService } from '../keybinding';
import { BrowserKeyboardLayoutImpl, KeyValidator } from '../keyboard';
import { ComponentContribution, ComponentRegistry, ComponentRegistryImpl, TabBarToolbarContribution } from '../layout';
import { ILogger, Logger } from '../logger';
import {
  AbstractContextMenuService,
  AbstractMenuService,
  AbstractMenubarService,
  ContextMenuServiceImpl,
  IMenuRegistry,
  MenuContribution,
  MenuRegistryImpl,
  MenuServiceImpl,
  MenubarServiceImpl,
} from '../menu/next';
import { IToolbarActionService, ToolbarActionService } from '../menu/next/toolbar-action.service';
import { IOpenerService } from '../opener';
import { OpenerService } from '../opener/opener.service';
import { PreferenceContribution } from '../preferences';
import { IProgressService } from '../progress';
import { ProgressService } from '../progress/progress.service';
import { SlotRendererContribution } from '../react-providers/slot';
import { CredentialsService, CryptoService, ICredentialsService, ICryptoService } from '../services';
import { BrowserClipboardService, IClipboardService } from '../services/clipboard.service';
import { ExternalUriService, IExternalUriService } from '../services/external-uri.service';
import { StaticResourceClientAppContribution } from '../static-resource/index';
import { StaticResourceContribution, StaticResourceService } from '../static-resource/static.definition';
import { StaticResourceServiceImpl } from '../static-resource/static.service';
import { IToolbarPopoverRegistry, IToolbarRegistry, ToolBarActionContribution } from '../toolbar';
import { ToolbarPopoverRegistry } from '../toolbar/toolbar.popover.registry';
import { NextToolbarRegistryImpl, ToolbarClientAppContribution } from '../toolbar/toolbar.registry';
import { VariableContribution, VariableRegistry, VariableRegistryImpl } from '../variable';
import { IWindowService } from '../window';
import { WindowService } from '../window/window.service';

import { ClientAppContextContribution } from './context-contribution';
import { AppLifeCycleService } from './lifecycle.service';

export function injectInnerProviders(injector: Injector) {
  // 生成 ContributionProvider
  createContributionProvider(injector, ClientAppContribution);
  createContributionProvider(injector, CommandContribution);
  createContributionProvider(injector, FsProviderContribution);
  createContributionProvider(injector, KeybindingContribution);
  createContributionProvider(injector, MenuContribution);
  createContributionProvider(injector, ComponentContribution);
  createContributionProvider(injector, SlotRendererContribution);
  createContributionProvider(injector, PreferenceContribution);
  createContributionProvider(injector, VariableContribution);
  createContributionProvider(injector, TabBarToolbarContribution);
  createContributionProvider(injector, ToolBarActionContribution);
  createContributionProvider(injector, StaticResourceContribution);
  createContributionProvider(injector, ClientAppContextContribution);

  // 一些内置抽象实现
  const providers: Provider[] = [
    {
      token: IEventBus,
      useClass: EventBusImpl,
    },
    {
      token: CommandService,
      useClass: CommandServiceImpl,
    },
    {
      token: CommandRegistry,
      useClass: CommandRegistryImpl,
    },
    {
      token: KeybindingRegistry,
      useClass: KeybindingRegistryImpl,
    },
    {
      token: KeybindingService,
      useFactory: (inject: Injector) => inject.get(KeybindingRegistry),
    },
    {
      token: KeyboardNativeLayoutService,
      useClass: BrowserKeyboardLayoutImpl,
    },
    {
      token: KeyboardLayoutChangeNotifierService,
      useFactory: (inject: Injector) => inject.get(KeyboardNativeLayoutService),
    },
    {
      token: KeyValidator,
      useFactory: (inject: Injector) => inject.get(KeyboardNativeLayoutService),
    },
    ClientAppStateService,
    {
      token: ILogger,
      useClass: Logger,
    },
    {
      token: Logger,
      useAlias: ILogger,
    },
    {
      token: ComponentRegistry,
      useClass: ComponentRegistryImpl,
    },
    {
      token: VariableRegistry,
      useClass: VariableRegistryImpl,
    },
    // next version menu
    {
      token: AbstractMenuService,
      useClass: MenuServiceImpl,
    },
    {
      token: AbstractContextMenuService,
      useClass: ContextMenuServiceImpl,
    },
    {
      token: IMenuRegistry,
      useClass: MenuRegistryImpl,
    },
    {
      token: IToolbarActionService,
      useClass: ToolbarActionService,
    },
    {
      token: AbstractMenubarService,
      useClass: MenubarServiceImpl,
    },
    {
      token: IReporter,
      useClass: DefaultReporter,
    },
    {
      token: IReporterService,
      useClass: ReporterService,
    },
    {
      token: ReporterMetadata,
      useValue: {
        host: REPORT_HOST.BROWSER,
      },
    },
    {
      token: IProgressService,
      useClass: ProgressService,
    },
    {
      token: IToolbarRegistry,
      useClass: NextToolbarRegistryImpl,
    },
    {
      token: IToolbarPopoverRegistry,
      useClass: ToolbarPopoverRegistry,
    },
    ToolbarClientAppContribution,
    {
      token: IProblemPatternRegistry,
      useClass: ProblemPatternRegistryImpl,
    },
    {
      token: IProblemMatcherRegistry,
      useClass: ProblemMatchersRegistryImpl,
    },
    {
      token: ITaskDefinitionRegistry,
      useClass: TaskDefinitionRegistryImpl,
    },
    {
      token: IOpenerService,
      useClass: OpenerService,
    },
    {
      token: IWindowService,
      useClass: WindowService,
    },
    {
      token: IApplicationService,
      useClass: ApplicationService,
    },
    {
      token: IClipboardService,
      useClass: BrowserClipboardService,
    },
    {
      token: IExternalUriService,
      useClass: ExternalUriService,
    },
    {
      token: IAuthenticationService,
      useClass: AuthenticationService,
    },
    {
      token: ICryptoService,
      useClass: CryptoService,
    },
    {
      token: ICredentialsService,
      useClass: CredentialsService,
    },
    {
      token: IHashCalculateService,
      useClass: HashCalculateServiceImpl,
    },
    {
      token: IExtensionsSchemaService,
      useClass: ExtensionsPointServiceImpl,
    },
    {
      token: AppLifeCycleServiceToken,
      useClass: AppLifeCycleService,
    },
    {
      token: StaticResourceService,
      useClass: StaticResourceServiceImpl,
    },
    StaticResourceClientAppContribution,
    {
      token: ISplitPanelService,
      useClass: SplitPanelService,
    },
    {
      token: IAIReporter,
      useClass: AIReporter,
    },
    {
      token: IDesignStyleService,
      useClass: DesignStyleService,
    },
    {
      token: ConnectionHelperFactory,
      useFactory: ConnectionHelperFactory,
    },
  ];
  injector.addProviders(...providers);
}
