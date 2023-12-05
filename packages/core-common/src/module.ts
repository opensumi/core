/**
 * 项目中会使用到的模块接口定义
 */

import { Autowired, INJECTOR_TOKEN, Injector, Provider, ConstructorOf, Token, Domain } from '@opensumi/di';

interface FrontService {
  token: Token;
  servicePath: string;
}

export interface BackService {
  token?: Token;
  clientToken?: Token;
  servicePath: string;
}

export interface BackService2 {
  token?: Token;
  clientToken?: Token;
  servicePath: string;
  protocol: object;
}

export class BasicModule {
  @Autowired(INJECTOR_TOKEN)
  protected injector: Injector;
  providers?: Provider[];
  electronProviders?: Provider[];
  webProviders?: Provider[];
  contributionProvider: Domain | Domain[];

  // rpc
  backServices?: BackService[];
  frontServices?: FrontService[];

  // new rpc service
  backServices2?: BackService2[];
}

export function ModuleDependencies<T extends BasicModule>(dependencies: ConstructorOf<BasicModule>[]) {
  return (target) => {
    Reflect.defineMetadata('dependencies', dependencies, target);
  };
}
