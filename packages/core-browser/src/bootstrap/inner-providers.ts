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

import { KeybindingContribution, KeybindingService, KeybindingRegistryImpl, KeybindingRegistry, KeybindingContext } from '../keybinding';
import { BrowserKeyboardLayoutImpl } from '../keyboard';

import {
  ContextMenuRenderer,
  BrowserContextMenuRenderer,
} from '../menu';
import { Logger, ILogger } from '../logger';
import { ComponentRegistry, ComponentRegistryImpl, ComponentContribution, TabBarToolbarContribution } from '../layout';
import { useNativeContextMenu } from '../utils';
import { ElectronContextMenuRenderer } from '../menu/electron/electron-menu';
import { createElectronMainApi } from '../utils/electron';
import { IElectronMainUIService, IElectronMainLifeCycleService } from '@ali/ide-core-common/lib/electron';
import { PreferenceContribution } from '../preferences';
import { VariableRegistry, VariableRegistryImpl, VariableContribution} from '../variable';

import { AbstractMenuService, MenuServiceImpl, AbstractMenubarService, MenubarServiceImpl, IMenuRegistry, MenuRegistryImpl, NextMenuContribution } from '../menu/next';
import { ICtxMenuRenderer } from '../menu/next/renderer/ctxmenu/base';
import { ElectronCtxMenuRenderer, ElectronMenuBarService, IElectronMenuFactory, IElectronMenuBarService, ElectronMenuFactory } from '../menu/next/renderer/ctxmenu/electron';
import { BrowserCtxMenuRenderer } from '../menu/next/renderer/ctxmenu/browser';

export function injectInnerProviders(injector: Injector) {
  // 生成 ContributionProvider
  createContributionProvider(injector, ClientAppContribution);
  createContributionProvider(injector, CommandContribution);
  createContributionProvider(injector, KeybindingContribution);
  createContributionProvider(injector, NextMenuContribution);
  createContributionProvider(injector, MenuContribution);
  createContributionProvider(injector, KeybindingContext);
  createContributionProvider(injector, ComponentContribution);
  createContributionProvider(injector, PreferenceContribution);
  createContributionProvider(injector, VariableContribution);
  createContributionProvider(injector, TabBarToolbarContribution);

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
      useFactory: (inject: Injector) => {
        return inject.get(KeybindingRegistry);
      },
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
    // next version menu
    {
      token: AbstractMenuService,
      useClass: MenuServiceImpl,
    },
    {
      token: IMenuRegistry,
      useClass: MenuRegistryImpl,
    },
    {
      token: ICtxMenuRenderer,
      useClass: useNativeContextMenu() ? ElectronCtxMenuRenderer : BrowserCtxMenuRenderer,
    },
    {
      token: AbstractMenubarService,
      useClass: MenubarServiceImpl,
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
