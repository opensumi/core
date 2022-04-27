import { Emitter } from '@opensumi/ide-core-common';

const emitters: Map<string, Emitter<any>> = new Map();

export function quickEvent<T>(name: string) {
  if (!emitters.has(name)) {
    emitters.set(name, new Emitter<T>());
  }
  return emitters.get(name)!.event;
}

export function quickFireEvent<T>(name: string, value: T) {
  if (emitters.has(name)) {
    emitters.get(name)!.fire(value);
  }
}

export function partialMock<T>(prefix: string, mocked: Partial<T>): T {
  return new Proxy(mocked, {
    get: (target, prop) => {
      if (target[prop]) {
        return target[prop];
      } else {
        return () => null;
      }
    },
  }) as T;
}
