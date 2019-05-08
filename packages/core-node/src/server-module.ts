import { BasicModule, ConstructorOf } from '@ali/ide-core';

export abstract class NodeController {

}

export interface ServerModule extends BasicModule {
  controllers: Array<ConstructorOf<NodeController>>;
}
