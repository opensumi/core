/**
 * 项目中会使用到的模块接口定义
 */

import { Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';

export class BasicModule {
  @Autowired(INJECTOR_TOKEN)
  protected injector: Injector;
}
