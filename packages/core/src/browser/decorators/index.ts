import { ConstructorOf } from '../../common';

export function ViewEvent(Cmd: ConstructorOf<any>): MethodDecorator {
  return (target: any) => {
    // nothing
  };
}
