import { ConstructorOf } from '@ali/ide-core';

export function ViewEvent(Cmd: ConstructorOf<any>): MethodDecorator {
  return (target: any) => {
    // nothing
  };
}
