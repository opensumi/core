/**
 * 项目中会使用到的模块接口定义
 */

import { Autowired, INJECTOR_TOKEN, Injector, Provider, ConstructorOf, Token, Domain } from '@ali/common-di';

interface FrontService {
  token: ConstructorOf,
  servicePath: string,
}

interface BackService {
  token?: ConstructorOf,
  clientToken?: ConstructorOf,
  servicePath: string,
}

export class BasicModule {
  @Autowired(INJECTOR_TOKEN)
  protected injector: Injector;
  providers?: Provider[];
  backServices?: BackService[];
  frontServices?: FrontService[];
  contributionProvider: Domain | Domain[];
}
