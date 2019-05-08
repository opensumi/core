import { Injector } from '@ali/common-di';
import { EventManager, Request } from '@ali/ide-core';
import { ModuleLoader } from './module-loader';
import { ServerModule } from './server-module';

export class RequestHandler {
  private eventManager: EventManager;

  constructor(
    serverModules: ServerModule[],
    injector = new Injector([]),
  ) {
    const loader = new ModuleLoader(injector, serverModules);
    this.eventManager = loader.getEventManager();
  }

  async handle(request: Request) {
    const { domain, method, args } = request;
    const eventName = `${domain}.${method}`;
    const fn = this.eventManager.getHandler(eventName);
    const result = fn && (await fn(...args));

    return { fn, result };
  }
}
