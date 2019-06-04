import { Provider, Injector } from '@ali/common-di';
import {
  IEventBus,
  EventBusImpl,
  CommandService,
  CommandRegistryImpl,
  CommandContribution,
  CommandContributionProvider,

  MenuContribution,
  MenuContributionProvider,

  BaseContributionProvider,
  createContributionProvider,
  CommandServiceImpl,
  CommandRegistry,
} from '@ali/ide-core-common';

import {
  ContextMenuRenderer,
  BrowserContextMenuRenderer,
  BrowserMainMenuFactory,
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
      token: IEventBus,
      useClass: EventBusImpl,
    },
    {
      token: ContextMenuRenderer,
      useClass: BrowserContextMenuRenderer,
    },
  ];

  // 生成 CommandContributionProvider
  createContributionProvider(injector, CommandContribution, CommandContributionProvider);
  createContributionProvider(injector, MenuContribution, MenuContributionProvider);

  injector.addProviders(...providers);
}
