import { Provider } from '@ali/common-di';
import { IEventBus, EventBusImpl } from '../event-bus';
import { CommandService, CommandRegistryImpl } from '../command';
import { KeybindingService, KeybindingRegistryImpl } from '@ali/ide-core-browser';

export const innerProviders: Provider[] = [
  {
    token: CommandService,
    useClass: CommandRegistryImpl,
  },
  // {
  //   token: KeybindingService,
  //   useClass: KeybindingRegistryImpl,
  // },
  {
    token: IEventBus,
    useClass: EventBusImpl,
  }
];
