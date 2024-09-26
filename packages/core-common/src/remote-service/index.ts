import { ConstructorOf, Injector, Token, markInjectable } from '@opensumi/di';

import { RPCProtocol } from '../types/rpc';

export * from './data-store';

export const CLIENT_ID_TOKEN = Symbol('CLIENT_ID_TOKEN');

const RemoteServiceInstantiateFlag = Symbol('RemoteServiceInstantiateFlag');
const __remoteServiceInstantiateFlagAllowed = Symbol('RemoteServiceInstantiateFlag_allow');
const __remoteServiceInstantiateFlagDisallowed = Symbol('RemoteServiceInstantiateFlag_disallow');

export function RemoteService(servicePath: string, protocol?: RPCProtocol<any>) {
  return function <T extends new (...args: any[]) => any>(constructor: T) {
    markInjectable(constructor);

    return class extends constructor {
      servicePath = servicePath;
      protocol = protocol;

      constructor(...args: any[]) {
        if (args.length > 1) {
          throw new Error('RemoteService can be only instantiated when frontend first connected.');
        }
        if (__remoteServiceInstantiateFlagAllowed !== args[0]) {
          throw new Error('RemoteService can be only instantiated when frontend first connected.');
        }

        super(...args);
      }
    };
  };
}

RemoteService.getName = function (service: Token | ConstructorOf<any>): string {
  if (typeof service === 'function') {
    return service.name;
  }
  return String(service);
};

export interface RemoteServiceInternal<Client = any> {
  servicePath: string;
  protocol?: RPCProtocol<any>;

  rpcClient: Client[];

  setConnectionClientId?(clientId: string): void;
}

export function createRemoteService(injector: Injector, service: Token | ConstructorOf<any>): RemoteServiceInternal {
  const flag = injector.get(RemoteServiceInstantiateFlag);
  return injector.get(service, [flag]);
}

export function createRemoteServiceChildInjector(injector: Injector, fn: (childInjector: Injector) => void): Injector {
  const child = injector.createChild([
    {
      token: RemoteServiceInstantiateFlag,
      useValue: __remoteServiceInstantiateFlagAllowed,
    },
  ]);

  fn(child);

  child.overrideProviders({
    token: RemoteServiceInstantiateFlag,
    useValue: __remoteServiceInstantiateFlagDisallowed,
    override: true,
  });

  return child;
}
