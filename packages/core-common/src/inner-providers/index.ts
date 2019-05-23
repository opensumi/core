import { Provider } from '@ali/common-di';
import { IEventBus, EventBusImpl } from '../event-bus';
import { CommandService, CommandRegistryImpl } from '../command';

export const innerProviders: Provider[] = [
  {
    token: CommandService,
    useClass: CommandRegistryImpl,
  },
  {
    token: IEventBus,
    useClass: EventBusImpl,
  }
];
