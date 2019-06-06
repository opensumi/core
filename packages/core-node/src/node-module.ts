import { BasicModule } from '@ali/ide-core-common';

export abstract class NodeModule extends BasicModule {
  // TODO
  onConfigureServer?(app: any);
}
