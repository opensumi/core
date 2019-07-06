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
  ILogger,
} from '@ali/ide-core-common';
import { ClientAppContribution } from './app';
import { ClientAppStateService } from '../application/application-state-service';

import { KeyboardNativeLayoutService, KeyboardLayoutChangeNotifierService } from '@ali/ide-core-common/lib/keyboard/keyboard-layout-provider';

import { KeybindingContribution, KeybindingService, KeybindingServiceImpl, KeybindingRegistryImpl, KeybindingRegistry, KeybindingContext } from '../keybinding';
import { BrowserKeyboardLayoutImpl } from '../keyboard';
import { PreferenceService, PreferenceServiceImpl } from '../preferences';
import {
  ContextMenuRenderer,
  BrowserContextMenuRenderer,
} from '../menu';
import { Logger } from '../logger';

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
    {
      token: ILogger,
      useClass: Logger,
    },
  ];
  injector.addProviders(...providers);

  // 生成 ContributionProvider
  createContributionProvider(injector, ClientAppContribution);
  createContributionProvider(injector, CommandContribution);
  createContributionProvider(injector, KeybindingContribution);
  createContributionProvider(injector, MenuContribution);
  createContributionProvider(injector, KeybindingContext);
}
