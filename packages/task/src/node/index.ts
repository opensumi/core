import { Provider, Injectable } from '@ide-framework/common-di';
import { NodeModule } from '@ide-framework/ide-core-node';

@Injectable()
export class TaskModule extends NodeModule {
  providers: Provider[] = [];
}
