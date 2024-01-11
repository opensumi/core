/**
 * 项目中会使用到的模块接口定义
 */

import { Autowired, INJECTOR_TOKEN, Injector, Provider, ConstructorOf, Token, Domain } from '@opensumi/di';

import { RPCProtocol } from './types/protocol';

interface FrontService {
  token: Token;
  servicePath: string;
  protocol?: RPCProtocol<any>;
}

export interface BackService {
  token?: Token;
  clientToken?: Token;
  servicePath: string;
  protocol?: RPCProtocol<any>;
}

export class BasicModule {
  @Autowired(INJECTOR_TOKEN)
  protected injector: Injector;
  providers?: Provider[];
  electronProviders?: Provider[];
  webProviders?: Provider[];
  backServices?: BackService[];
  frontServices?: FrontService[];
  contributionProvider: Domain | Domain[];
}

export function ModuleDependencies<T extends BasicModule>(dependencies: ConstructorOf<BasicModule>[]) {
  return (target) => {
    Reflect.defineMetadata('dependencies', dependencies, target);
  };
}
