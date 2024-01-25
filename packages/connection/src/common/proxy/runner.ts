import { EventEmitter } from '@opensumi/events';

import { IRPCServiceMap, RPCServiceMethod } from '../types';
import { getServiceMethods } from '../utils';

/**
 * Store all executable services
 */
export class ServiceRunner {
  protected emitter = new EventEmitter<{
    servicesUpdate: [services: string[]];
  }>();

  private serviceMethodMap = {} as unknown as IRPCServiceMap;

  register(name: string, methodFn: RPCServiceMethod) {
    this.serviceMethodMap[name] = methodFn;
    this.emitter.emit('servicesUpdate', [name]);
  }

  registerService(
    service: any,
    options?: {
      nameConverter?: (str: string) => string;
    },
  ) {
    const serviceNames = [] as string[];
    const { nameConverter } = options || {};
    const methods = getServiceMethods(service);
    for (const method of methods) {
      let methodName = method;
      if (nameConverter) {
        methodName = nameConverter(method);
      }

      this.serviceMethodMap[methodName] = service[method].bind(service);
      serviceNames.push(methodName);
    }

    this.emitter.emit('servicesUpdate', serviceNames);
  }

  has(name: PropertyKey) {
    return !!this.serviceMethodMap[name];
  }

  run(name: PropertyKey, ...args: any[]): any {
    return this.serviceMethodMap[name](...args);
  }

  getServices() {
    return Object.keys(this.serviceMethodMap);
  }

  onServicesUpdate(cb: (services: string[]) => void) {
    this.emitter.on('servicesUpdate', cb);
  }
}
