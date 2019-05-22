import { Provider } from '@ali/common-di';
import { IEventBus, EventBusImpl } from '../event-bus';
import { CommandService, CommandRegistry } from '../command';

export const innerProviders: Provider[] = [
  {
    token: CommandService,
    useClass: CommandRegistry,
  },
  {
    token: IEventBus,
    useClass: EventBusImpl,
  }
];
