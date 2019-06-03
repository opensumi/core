import { Provider, Injector } from '@ali/common-di';
import {
  IEventBus,
  EventBusImpl,
  CommandService,
  CommandRegistryImpl,
  CommandContribution,
  CommandContributionProvider,
  createContributionProvider,
  CommandServiceImpl,
  CommandRegistry,
} from '@ali/ide-core-common';

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
  ];

  // 生成 CommandContributionProvider
  createContributionProvider(injector, CommandContribution, CommandContributionProvider);

  injector.addProviders(...providers);
}
