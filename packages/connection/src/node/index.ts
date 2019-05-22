import { Provider } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';

// export class ConnectionModule extends NodeModule {
//   providers: Provider[] = [];
// }

export * from './ws';
export * from './channel-handler';
export * from './stub';
