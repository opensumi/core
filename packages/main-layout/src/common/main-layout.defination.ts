import { Injectable, Provider } from '@ali/common-di';
import { ConstructorOf } from '@ali/ide-core-common';

@Injectable()
export abstract class MainLayoutAPI {
}

export function createMainLayoutAPIProvider<T extends MainLayoutAPI>(cls: ConstructorOf<T>): Provider {
  return {
    token: MainLayoutAPI as any,
    useClass: cls as any,
  };
}
