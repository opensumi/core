
import { Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

@Injectable()
export class MockContextKeyService extends Disposable {
  store: Map<string, any> = new Map();
  createKey(key: string, value: any) {
    this.store.set(key, value);
    return {
      set: (val: any) => {
        this.store.set(key, val);
      },
    };
  }
  createScoped() {
    return this;
  }
  match(key) {
    return this.store.get(key) !== undefined;
  }
}
