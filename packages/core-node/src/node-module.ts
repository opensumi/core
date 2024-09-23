import { BasicModule, ConstructorOf } from '@opensumi/ide-core-common';

import { BackService } from './back-service';

export abstract class NodeModule extends BasicModule {
  backServices2?: ConstructorOf<BackService>[];
}
