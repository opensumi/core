import { BasicModule, ConstructorOf } from '../common';

export abstract class NodeController {

}

export interface NodeModule extends BasicModule {
  controllers: Array<ConstructorOf<NodeController>>;
}
