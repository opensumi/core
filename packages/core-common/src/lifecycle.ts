/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from './disposable';
import { once } from './functional';

// 保留
export interface IReference<T> extends IDisposable {
  readonly object: T;
}

export abstract class ReferenceCollection<T> {
  private references: { [key: string]: { readonly object: T; counter: number } } = Object.create(null);

  constructor() {}

  acquire(key: string): IReference<T> {
    let reference = this.references[key];

    if (!reference) {
      reference = this.references[key] = { counter: 0, object: this.createReferencedObject(key) };
    }

    const { object } = reference;
    const dispose = once(() => {
      if (--reference.counter === 0) {
        this.destroyReferencedObject(key, reference.object);
        delete this.references[key];
      }
    });

    reference.counter++;

    return { object, dispose };
  }

  protected abstract createReferencedObject(key: string): T;
  protected abstract destroyReferencedObject(key: string, object: T): void;
}

export class ImmortalReference<T> implements IReference<T> {
  constructor(public object: T) {}
  dispose(): void {
    /* noop */
  }
}
