import { Injectable, Provider } from '@ali/common-di';
import { ConstructorOf } from '@ali/ide-core-common';

@Injectable()
export abstract class MenuBarAPI {
}

export function createMenuBarAPIProvider<T extends MenuBarAPI>(cls: ConstructorOf<T>): Provider {
  return {
    token: MenuBarAPI as any,
    useClass: cls as any,
  };
}
