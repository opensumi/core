import { Provider, Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

@Injectable()
export class CollaborationServerModule extends NodeModule {
  providers: Provider[] = [];
}
