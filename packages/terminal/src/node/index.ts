import { Provider } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';

export class TerminalModule extends NodeModule {
  providers: Provider[] = [];
}
