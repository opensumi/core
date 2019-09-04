import { Provider, Injector } from '@ali/common-di';
import {
  IEventBus,
  EventBusImpl,
  CommandService,
  CommandRegistryImpl,
  CommandContribution,
  MenuContribution,
  createContributionProvider,
  CommandServiceImpl,
  CommandRegistry,
  IElectronMainMenuService,
  isElectronRenderer,
} from '@ali/ide-core-common';
import { ClientAppContribution } from '../common';
import { ClientAppStateService } from '../application/application-state-service';

import { KeyboardNativeLayoutService, KeyboardLayoutChangeNotifierService } from '@ali/ide-core-common/lib/keyboard/keyboard-layout-provider';

import { KeybindingContribution, KeybindingService, KeybindingServiceImpl, KeybindingRegistryImpl, KeybindingRegistry, KeybindingContext } from '../keybinding';
import { BrowserKeyboardLayoutImpl } from '../keyboard';

import {
  ContextMenuRenderer,
  BrowserContextMenuRenderer,
  IElectronMenuFactory,
} from '../menu';
import { Logger, ILogger } from '../logger';
import { ComponentRegistry, ComponentRegistryImpl, ComponentContribution } from '../layout';
import { useNativeContextMenu } from '../utils';
import { ElectronContextMenuRenderer, ElectronMenuFactory } from '../menu/electron/electron-menu';
import { createElectronMainApi } from '../utils/electron';
import { IElectronMainUIService } from '@ali/ide-core-common/lib/electron';
import { PreferenceContribution } from '../preferences';
import { CoreContribution } from '../core-contribution';
import { VariableRegistry, VariableRegistryImpl, VariableContribution} from '../variable';
import { IElectronMainLifeCycleService } from '../../../core-common/lib/electron';

export function injectInnerProviders(injector: Injector) {
  // 生成 ContributionProvider
  createContributionProvider(injector, ClientAppContribution);
  createContributionProvider(injector, CommandContribution);
  createContributionProvider(injector, KeybindingContribution);
  createContributionProvider(injector, MenuContribution);
  createContributionProvider(injector, KeybindingContext);
  createContributionProvider(injector, ComponentContribution);
  createContributionProvider(injector, PreferenceContribution);
  createContributionProvider(injector, VariableContribution);
  const contributions = [
    CoreContribution,
  ];
  injector.addProviders(...contributions);
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
      token: KeybindingService,
      useClass: KeybindingServiceImpl,
    },
    {
      token: KeybindingRegistry,
      useClass: KeybindingRegistryImpl,
    },
    {
      token: KeyboardNativeLayoutService,
      useClass: BrowserKeyboardLayoutImpl,
    },
    {
      token: KeyboardLayoutChangeNotifierService,
      useClass: BrowserKeyboardLayoutImpl,
    },
    {
      token: ContextMenuRenderer,
      useClass: useNativeContextMenu() ? ElectronContextMenuRenderer :  BrowserContextMenuRenderer,
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
  ];
  injector.addProviders(...providers);

  // 为electron添加独特的api服务，主要是向electron-main进行调用的服务
  if (isElectronRenderer()) {
    injector.addProviders({
      token: IElectronMainMenuService,
      useValue: createElectronMainApi('menu'),
    }, {
      token: IElectronMainUIService,
      useValue: createElectronMainApi('ui'),
    }, {
      token: IElectronMainLifeCycleService,
      useValue: createElectronMainApi('lifecycle'),
    }, {
      token: IElectronMenuFactory,
      useClass: ElectronMenuFactory,
    });
  }

  // 生成 ContributionProvider
  createContributionProvider(injector, ClientAppContribution);
  createContributionProvider(injector, CommandContribution);
  createContributionProvider(injector, KeybindingContribution);
  createContributionProvider(injector, MenuContribution);
  createContributionProvider(injector, KeybindingContext);
  createContributionProvider(injector, ComponentContribution);
}
