import { Provider, Injector } from '@ali/common-di';
import {
  IEventBus,
  EventBusImpl,
  CommandService,
  CommandRegistryImpl,
  CommandContribution,
  CommandContributionProvider,
  BaseContributionProvider,
  getDomainConstructors,
} from '@ali/ide-core-common';

import { NativeKeyboardLayout, KeyboardLayoutProvider, KeyboardLayoutChangeNotifier, KeyValidator, KeyValidationInput } from '@ali/ide-core-common/lib/keyboard/keyboard-layout-provider';

import { KeybindingContribution, KeybindingContributionProvider, KeybindingService, KeybindingRegistryImpl, BrowserKeyboardLayoutProvider } from '../index';

import { BrowserKeyboardFrontendContribution } from '../keyboard';

export function injectInnerProviders(injector: Injector) {
  // 一些内置抽象实现
  const providers: Provider[] = [
    {
      token: CommandService,
      useClass: CommandRegistryImpl,
    },
    {
      token: KeybindingService,
      useClass: KeybindingRegistryImpl,
    },
    {
      token: KeyboardLayoutProvider,
      useClass: BrowserKeyboardLayoutProvider,
    },
    {
      token: KeyboardLayoutChangeNotifier,
      useClass: BrowserKeyboardLayoutProvider,
    },
    {
      token: IEventBus,
      useClass: EventBusImpl,
    },
    BrowserKeyboardFrontendContribution,
  ];

  injector.addProviders(...providers);

  // 生成 CommandContributionProvider
  const commandContributionProvider = injector.get(BaseContributionProvider, [CommandContribution]);
  const keybindingContributionProvider = injector.get(BaseContributionProvider, [KeybindingContribution]);
  // 添加 commandContributionProvider 的 provider
  injector.addProviders({
    token: CommandContributionProvider,
    useValue: commandContributionProvider,
  });
  injector.addProviders({
    token: KeybindingContributionProvider,
    useValue: keybindingContributionProvider,
  });

}
