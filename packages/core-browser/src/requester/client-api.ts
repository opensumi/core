import { Injectable, Autowired } from '@ali/common-di';
import { REQUESTER_TOKEN, Requester, Disposable, ConstructorOf } from '@ali/ide-core';

@Injectable()
export class BasicClientAPI extends Disposable {
  @Autowired(REQUESTER_TOKEN)
  requester!: Requester;
}

interface WithRequester {
  requester: Requester;
}

abstract class AbstractCls {

}

export function createApiClass<
  TParent extends ConstructorOf<WithRequester>,
  TAbstract extends typeof AbstractCls,
  TKey extends keyof TAbstract['prototype'],
>(
  Parent: TParent,
  Abstract: TAbstract,
  methods: TKey[],
): new (...args: ConstructorParameters<TParent>) => InstanceType<TParent> & Pick<TAbstract['prototype'], TKey> {
  class APIClass extends Parent {}

  const domain = Abstract.name;
  for (const method of methods) {
    if (typeof method === 'string') {
      APIClass.prototype[method] = function(this: WithRequester, ...args: any[]) {
        return this.requester.send({ domain, method, args });
      };
    }
  }

  return APIClass as any;
}
