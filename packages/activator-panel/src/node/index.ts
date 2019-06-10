import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';

@Injectable()
export class ActivatorPanelModule extends NodeModule {
  providers: Provider[] = [];
}
