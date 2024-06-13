import { DisposableStore, Emitter, IDisposable } from '@opensumi/ide-core-common';

import { IMessageIO, TSumiProtocol, TSumiProtocolMethod } from '../rpc';
import { RPCServiceMethod } from '../types';

const skipMethods = new Set(['constructor']);

export function getServiceMethods(service: any): string[] {
  const props = new Set<string>();

  let obj = service;
  do {
    const propertyNames = Object.getOwnPropertyNames(obj);

    for (const prop of propertyNames) {
      if (skipMethods.has(prop)) {
        continue;
      }

      if (typeof service[prop] === 'function') {
        props.add(prop);
      }
    }
  } while ((obj = Object.getPrototypeOf(obj)));

  const array = Array.from(props);
  array.sort();
  return array;
}

/**
 * Store all executable services, and provide a way to invoke them.
 */
export class ServiceRegistry implements IDisposable {
  private _disposables = new DisposableStore();

  protected emitter = this._disposables.add(new Emitter<string[]>());
  onServicesUpdate = this.emitter.event;

  private serviceMethodMap = new Map<PropertyKey, RPCServiceMethod>();

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

  dispose() {
    this._disposables.dispose();
  }
}

export class ProtocolRegistry {
  protected _disposables = new DisposableStore();

  protected emitter = this._disposables.add(new Emitter<string[]>());
  onProtocolUpdate = this.emitter.event;

  private protocolMap = new Map<PropertyKey, TSumiProtocolMethod>();

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

  applyTo(io: IMessageIO) {
    if (!io.loadProtocolMethod) {
      return;
    }

    for (const protocol of this.protocolMap.values()) {
      io.loadProtocolMethod(protocol);
    }

    this._disposables.add(
      this.onProtocolUpdate((methods) => {
        if (!io.loadProtocolMethod) {
          return;
        }

        for (const method of methods) {
          const protocol = this.protocolMap.get(method);
          if (protocol) {
            io.loadProtocolMethod(protocol);
          }
        }
      }),
    );
  }

  dispose() {
    this._disposables.dispose();
  }
}
