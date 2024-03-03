import { Emitter } from '@opensumi/ide-core-common';

import { MessageIO, TSumiProtocol, TSumiProtocolMethod } from '../rpc';
import { RPCServiceMethod } from '../types';

export function getServiceMethods(service: any): string[] {
  let props: any[] = [];

  if (/^\s*class/.test(service.constructor.toString())) {
    let obj = service;
    do {
      props = props.concat(Object.getOwnPropertyNames(obj));
    } while ((obj = Object.getPrototypeOf(obj)));
    props = props.sort().filter((e, i, arr) => e !== arr[i + 1] && typeof service[e] === 'function');
  } else {
    for (const prop in service) {
      if (service[prop] && typeof service[prop] === 'function') {
        props.push(prop);
      }
    }
  }

  return props;
}

/**
 * Store all executable services
 */
export class ServiceRegistry {
  protected emitter = new Emitter<string[]>();

  private serviceMethodMap = new Map<PropertyKey, RPCServiceMethod>();

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

export class ProtocolRegistry {
  protected emitter = new Emitter<string[]>();

  private protocolMap = new Map<PropertyKey, TSumiProtocolMethod>();

  onProtocolUpdate = this.emitter.event;

  addProtocol(
    protocol: TSumiProtocol,
    options?: {
      nameConverter?: (str: string) => string;
    },
  ) {
    const serviceNames = [] as string[];
    const { nameConverter } = options || {};
    const { methods } = protocol;

    for (const proto of methods) {
      let method = proto.method;
      if (nameConverter) {
        method = nameConverter(method);
      }

      this.protocolMap.set(method, {
        ...proto,
        method,
      });
      serviceNames.push(method);
    }

    this.emitter.fire(serviceNames);
  }

  applyTo(io: MessageIO) {
    for (const protocol of this.protocolMap.values()) {
      io.loadProtocolMethod(protocol);
    }

    this.onProtocolUpdate((methods) => {
      for (const method of methods) {
        const protocol = this.protocolMap.get(method);
        if (protocol) {
          io.loadProtocolMethod(protocol);
        }
      }
    });
  }
}
