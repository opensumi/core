import { Provider } from '@ali/common-di';
import { CommandService, CommandRegistry } from '@ali/ide-core-common';

// 一些内置抽象实现
export const innerProviders: Provider[] = [
  {
    token: CommandService,
    useClass: CommandRegistry
  }
]
