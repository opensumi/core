import { Provider, Injector } from '@opensumi/di';
import {
  IEventBus,
  EventBusImpl,
  CommandService,
  CommandRegistryImpl,
  CommandContribution,
  createContributionProvider,
  CommandServiceImpl,
  CommandRegistry,
  IElectronMainMenuService,
  ReporterMetadata,
  IReporter,
  IReporterService,
  DefaultReporter,
  ReporterService,
  REPORT_HOST,
  IProblemPatternRegistry,
  ProblemPatternRegistryImpl,
  IProblemMatcherRegistry,
  ProblemMatchersRegistryImpl,
  ITaskDefinitionRegistry,
  TaskDefinitionRegistryImpl,
  IApplicationService,
  IAuthenticationService,
} from '@opensumi/ide-core-common';
import {
  IElectronMainUIService,
  IElectronMainLifeCycleService,
  IElectronURLService,
} from '@opensumi/ide-core-common/lib/electron';
import {
  HashCalculateServiceImpl,
  IHashCalculateService,
} from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';
import {
  KeyboardNativeLayoutService,
  KeyboardLayoutChangeNotifierService,
} from '@opensumi/ide-core-common/lib/keyboard/keyboard-layout-provider';

import { ClientAppStateService } from '../application/application-state-service';
import { ApplicationService } from '../application/application.service';
import { AuthenticationService } from '../authentication/authentication.service';
import { ClientAppContribution } from '../common';
import { FsProviderContribution } from '../fs';
import { KeybindingContribution, KeybindingService, KeybindingRegistryImpl, KeybindingRegistry } from '../keybinding';
import { BrowserKeyboardLayoutImpl, KeyValidator } from '../keyboard';
import { ComponentRegistry, ComponentRegistryImpl, ComponentContribution, TabBarToolbarContribution } from '../layout';
import { Logger, ILogger } from '../logger';
import {
  AbstractMenuService,
  MenuServiceImpl,
  AbstractMenubarService,
  MenubarServiceImpl,
  IMenuRegistry,
  MenuRegistryImpl,
  MenuContribution,
  AbstractContextMenuService,
  ContextMenuServiceImpl,
} from '../menu/next';
import { ICtxMenuRenderer } from '../menu/next/renderer/ctxmenu/base';
import { BrowserCtxMenuRenderer } from '../menu/next/renderer/ctxmenu/browser';
import {
  ElectronCtxMenuRenderer,
  ElectronMenuBarService,
  IElectronMenuFactory,
  IElectronMenuBarService,
  ElectronMenuFactory,
} from '../menu/next/renderer/ctxmenu/electron';
import { ToolbarActionService, IToolbarActionService } from '../menu/next/toolbar-action.service';
import { IOpenerService } from '../opener';
import { OpenerService } from '../opener/opener.service';
import { PreferenceContribution } from '../preferences';
import { IProgressService } from '../progress';
import { ProgressService } from '../progress/progress.service';
import { AppConfig, SlotRendererContribution } from '../react-providers';
import { CredentialsService, ICredentialsService, CryptrService, ICryptrService } from '../services';
import { IClipboardService, BrowserClipboardService } from '../services/clipboard.service';
import { IExternalUriService, ExternalUriService } from '../services/external-uri.service';
import { IToolbarPopoverRegistry, IToolbarRegistry, ToolBarActionContribution } from '../toolbar';
import { ToolbarPopoverRegistry } from '../toolbar/toolbar.popover.registry';
import { NextToolbarRegistryImpl, ToolbarClientAppContribution } from '../toolbar/toolbar.registry';
import { useNativeContextMenu } from '../utils';
import { createElectronMainApi } from '../utils/electron';
import { VariableRegistry, VariableRegistryImpl, VariableContribution } from '../variable';
import { IWindowService } from '../window';
import { WindowService } from '../window/window.service';


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
      token: ICtxMenuRenderer,
      useClass: useNativeContextMenu() ? ElectronCtxMenuRenderer : BrowserCtxMenuRenderer,
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
      token: ICryptrService,
      useClass: CryptrService,
    },
    {
      token: ICredentialsService,
      useClass: CredentialsService,
    },
    {
      token: IHashCalculateService,
      useClass: HashCalculateServiceImpl,
    },
  ];
  injector.addProviders(...providers);

  const appConfig: AppConfig = injector.get(AppConfig);
  // 为electron添加独特的api服务，主要是向electron-main进行调用的服务
  if (appConfig.isElectronRenderer) {
    injector.addProviders(
      {
        token: IElectronMainMenuService,
        useValue: createElectronMainApi(IElectronMainMenuService),
      },
      {
        token: IElectronMainUIService,
        useValue: createElectronMainApi(IElectronMainUIService),
      },
      {
        token: IElectronMainLifeCycleService,
        useValue: createElectronMainApi(IElectronMainLifeCycleService),
      },
      {
        token: IElectronURLService,
        useValue: createElectronMainApi(IElectronURLService),
      },
      {
        token: IElectronMenuFactory,
        useClass: ElectronMenuFactory,
      },
      {
        token: IElectronMenuBarService,
        useClass: ElectronMenuBarService,
      },
    );
  }
}
