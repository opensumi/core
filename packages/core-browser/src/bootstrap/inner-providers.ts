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
  const commandContributionProvider = injector.get(BaseContributionProvider, [CommandContribution]);
  // 添加 commandContributionProvider 的 provider
  injector.addProviders({
    token: CommandContributionProvider,
    useValue: commandContributionProvider,
  });

  injector.addProviders(...providers);
}
