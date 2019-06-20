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
} from '@ali/ide-core-common';
import { ClientAppContribution } from './app';
import { ClientAppStateService } from '../services/clientapp-status-service';

import { KeyboardNativeLayoutService, KeyboardLayoutChangeNotifierService } from '@ali/ide-core-common/lib/keyboard/keyboard-layout-provider';

import { KeybindingContribution, KeybindingService, KeybindingServiceImpl, KeybindingRegistryImpl, KeybindingRegistry, KeybindingContext, ContextKeyService } from '../keybinding';
import { BrowserKeyboardLayoutImpl } from '../keyboard';
import {
  ContextMenuRenderer,
  BrowserContextMenuRenderer,
} from '../menu';

export function injectInnerProviders(injector: Injector) {
  // 一些内置抽象实现
  const providers: Provider[] = [
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
      token: IEventBus,
      useClass: EventBusImpl,
    },
    {
      token: ContextMenuRenderer,
      useClass: BrowserContextMenuRenderer,
    },
    ClientAppStateService,
  ];
  injector.addProviders(...providers);

  // 生成 ContributionProvider
  createContributionProvider(injector, ClientAppContribution);
  createContributionProvider(injector, CommandContribution);
  createContributionProvider(injector, KeybindingContribution);
  createContributionProvider(injector, MenuContribution);
  createContributionProvider(injector, KeybindingContext);
}
