import { Provider, Injector } from '@ali/common-di';
import {
  IEventBus,
  EventBusImpl,
  CommandService,
  CommandRegistryImpl,
  CommandContribution,
  CommandContributionProvider,
  BaseContributionProvider,
  CommandServiceImpl,
  CommandRegistry,
} from '@ali/ide-core-common';

import { KeyboardNativeLayoutService, KeyboardLayoutChangeNotifierService } from '@ali/ide-core-common/lib/keyboard/keyboard-layout-provider';

import { KeybindingContribution, KeybindingContributionProvider, KeybindingService, KeybindingServiceImpl, KeybindingRegistryImpl, KeybindingRegistry } from '../keybinding';
import { BrowserKeyboardLayoutImpl, BrowserKeyboardFrontendContribution } from '../keyboard';

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
