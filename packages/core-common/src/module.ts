/**
 * 项目中会使用到的模块接口定义
 */

import { Autowired, ConstructorOf, Domain, INJECTOR_TOKEN, Injectable, Injector, Provider, Token } from '@opensumi/di';

import { RPCProtocol } from './types/rpc';

export interface BackService {
  token?: Token;
  clientToken?: Token;
  servicePath: string;
  protocol?: RPCProtocol<any>;
}

@Injectable()
export class BasicModule {
  @Autowired(INJECTOR_TOKEN)
  protected injector: Injector;

  providers?: Provider[];
  /**
   * providers only avaiable in electron
   */
  electronProviders?: Provider[];
  /**
   * providers only avaiable in web
   */
  webProviders?: Provider[];
  backServices?: BackService[];
  contributionProvider: Domain | Domain[];

  remoteServices?: (Token | ConstructorOf<any>)[];
}

export const ModuleDependenciesKey = 'dependencies';

export function ModuleDependencies<T extends BasicModule>(dependencies: ConstructorOf<T>[]) {
  return (target) => {
    Reflect.defineMetadata(ModuleDependenciesKey, dependencies, target);
  };
}

export function getModuleDependencies<T extends BasicModule>(target: ConstructorOf<T>): ConstructorOf<T>[] {
  return Reflect.getMetadata(ModuleDependenciesKey, target);
}
