import { Requester } from './requester';
import { ConstructorOf } from './declare';

interface WithRequester {
  requester: Requester;
}

export const DOMAIN_TOKEN = Symbol('DOMAIN_TOKEN');

// tslint:disable-next-line
export function DefineClientAPI(cls: Function) {
  const domain = cls.name;

  return <T extends WithRequester>(Target: ConstructorOf<T>) => {
    const properties = Object
      .getOwnPropertyNames(Target.prototype)
      .filter((method) => method !== 'constructor');

    for (const method of properties) {
      Target.prototype[method] = function(this: T, ...args: any[]) {
        return this.requester.send({ domain, method, args });
      };
    }
  };
}

// tslint:disable-next-line
export function DefineAPIController(cls: Function) {
  const domain = cls.name;

  return <T>(Target: ConstructorOf<T>) => {
    Reflect.defineMetadata(DOMAIN_TOKEN, domain, Target);
  };
}

// tslint:disable-next-line
export function getDomainOf(Target: Function) {
  return Reflect.getMetadata(DOMAIN_TOKEN, Target);
}
