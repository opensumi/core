import { Provider } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';

export class GitModule extends NodeModule {
  providers: Provider[] = [];
}
