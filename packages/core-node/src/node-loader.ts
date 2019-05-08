import { EventManager, getDomainOf } from '@ali/ide-core';
import { Injector } from '@ali/common-di';
import { NodeModule } from './node-module';

export class NodeLoader {
  constructor(
    private injector: Injector,
    private modules: NodeModule[],
  ) {}

  getEventManager() {
    const manager = new EventManager();

    for (const module of this.modules) {
      for (const Controller of module.controllers) {
        const properties = Object
          .getOwnPropertyNames(Controller.prototype)
          .filter((method) => method !== 'constructor');

        const domain = getDomainOf(Controller);
        const controller = this.injector.get(Controller);
        for (const method of properties) {
          const fn = (controller as any)[method].bind(controller);
          const eventName = `${domain}.${method}`;
          manager.register(eventName, fn);
        }
      }
    }

    return manager;
  }
}
