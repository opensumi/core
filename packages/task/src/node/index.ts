import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';

@Injectable()
export class TaskModule extends NodeModule {
  providers: Provider[] = [];
}
