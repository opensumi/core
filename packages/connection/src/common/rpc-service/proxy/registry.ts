import { Emitter } from '@opensumi/ide-core-common';

import { IRPCServiceMap, RPCServiceMethod } from '../../types';
import { getServiceMethods } from '../../utils';

/**
 * Store all executable services
 */
export class ServiceRegistry {
  protected emitter = new Emitter<string[]>();

  private serviceMethodMap: IRPCServiceMap = new Map();

  onServicesUpdate = this.emitter.event;

  register(name: string, methodFn: RPCServiceMethod) {
    this.serviceMethodMap.set(name, methodFn);
    this.emitter.fire([name]);
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

      this.serviceMethodMap.set(methodName, service[method].bind(service));
      serviceNames.push(methodName);
    }

    this.emitter.fire(serviceNames);
  }

  has(name: PropertyKey) {
    return this.serviceMethodMap.has(name);
  }

  invoke(name: PropertyKey, ...args: any[]): any {
    // here because we have checked the existence of the method
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.serviceMethodMap.get(name)!(...args);
  }

  methods() {
    return Array.from(this.serviceMethodMap.keys());
  }
}
