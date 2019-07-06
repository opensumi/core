import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';

@Injectable()
export class WorkspaceModule extends NodeModule {
  providers: Provider[] = [];
}
