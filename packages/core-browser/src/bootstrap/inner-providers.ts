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
  const commandContributionProvider = injector.get(BaseContributionProvider, [CommandContribution]);
  // 添加 commandContributionProvider 的 provider
  injector.addProviders({
    token: CommandContributionProvider,
    useValue: commandContributionProvider,
  });

  const menuContributionProvider = injector.get(BaseContributionProvider, [MenuContribution]);
  injector.addProviders({
    token: MenuContributionProvider,
    useValue: menuContributionProvider,
  });

  injector.addProviders(...providers);
}
