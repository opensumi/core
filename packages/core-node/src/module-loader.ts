import { EventManager, getDomainOf } from '@ali/ide-core';
import { Injector } from '@ali/common-di';
import { ServerModule } from './server-module';

export class ModuleLoader {
  constructor(
    private injector: Injector,
    private modules: ServerModule[],
  ) {}

  getEventManager() {
    const manager = new EventManager();

    for (const module of this.modules) {
      for (const Controller of module.controllers) {
        const properties = Object
          .getOwnPropertyNames(Controller.prototype)
          .filter((method) => method !== 'constructor');

        const domain = getDomainOf(Controller);
        this.injector.addProviders(Controller);
        const controller = this.injector.get(Controller);
        for (const method of properties) {
          const fn = (controller as any)[method];
          if (typeof fn === 'function') {
            const eventName = `${domain}.${method}`;
            manager.register(eventName, fn.bind(controller));
          }
        }
      }
    }

    return manager;
  }
}
