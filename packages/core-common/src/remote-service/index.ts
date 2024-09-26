import { ConstructorOf, Inject, Injector, Token, markInjectable, setParameters } from '@opensumi/di';

import { RPCProtocol } from '../types/rpc';

export * from './data-store';

export const CLIENT_ID_TOKEN = Symbol('CLIENT_ID_TOKEN');

const RemoteServiceInstantiateFlag = Symbol('Do_Not_Allow_Instantiate_RemoteService');

const RemoteServiceDataSymbol = Symbol('RemoteServiceData');

function storeRemoteServiceData(target: any, servicePath: string, protocol?: RPCProtocol<any>) {
  Reflect.defineMetadata(RemoteServiceDataSymbol, { servicePath, protocol }, target);
}

export function getRemoteServiceData(target: any): { servicePath: string; protocol?: RPCProtocol<any> } | undefined {
  return Reflect.getMetadata(RemoteServiceDataSymbol, target);
}

export function RemoteService(servicePath: string, protocol?: RPCProtocol<any>) {
  return function <T extends new (...args: any[]) => any>(constructor: T) {
    markInjectable(constructor);
    setParameters(constructor, [Symbol]);
    Inject(RemoteServiceInstantiateFlag)(constructor, '', 0);
    storeRemoteServiceData(constructor, servicePath, protocol);
  };
}

RemoteService.getName = function (service: Token | ConstructorOf<any>): string {
  if (typeof service === 'function') {
    return service.name;
  }
  return String(service);
};

export interface RemoteServiceInternal<Client = any> {
  rpcClient: Client[];

  setConnectionClientId?(clientId: string): void;
}

export function runInRemoteServiceContext(injector: Injector, fn: () => void): Injector {
  injector.overrideProviders({
    token: RemoteServiceInstantiateFlag,
    useValue: RemoteServiceInstantiateFlag,
    override: true,
  });

  fn();

  injector.disposeOne(RemoteServiceInstantiateFlag);
  injector.creatorMap.delete(RemoteServiceInstantiateFlag);
  return injector;
}
