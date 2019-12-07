import { IDisposable, Disposable } from './disposable';
import { MaybePromise } from './async';
import { Emitter, Event } from './event';

// TODO key名与vscode的reference对齐
export interface IRef<T> {
  instance: T;
  reason?: string;
  dispose(): void;
  hold(reason?: string): IRef<T>;
  disposed: boolean;
}

export class ReferenceManager<T> {

  protected instances: Map<string, T> = new Map();

  protected refs: Map<string, Array<IRef<T>>> = new Map();

  protected _onReferenceAllDisposed = new Emitter<string>();

  protected _onInstanceCreated = new Emitter<T>();

  public onReferenceAllDisposed: Event<string> = this._onReferenceAllDisposed.event;

  public onInstanceCreated: Event<T> = this._onInstanceCreated.event;

  public _creating: Map<string, Promise<void>> = new Map();

  constructor(private factory: (key: string) => MaybePromise<T>) {

  }

  async getReference(key: string, reason?: string): Promise<IRef<T>> {
    if (!this.instances.has(key)) {
      if (!this._creating.has(key)) {
        const promise = ((async (resolve) => {
          const instance = await this.factory(key);
          this.instances.set(key, instance);
          this._onInstanceCreated.fire(instance);
        })());
        this._creating.set(key, promise);
      }
      await this._creating.get(key)!;
    }
    const ref =  this.createRef(key, reason);
    if (this._creating.get(key)) {
      this._creating.get(key)!.then(() => {
        this._creating.delete(key);
        this.removeRef(key, undefined);
      })
    }
    return ref;
  }

  getReferenceIfHasInstance(key: string, reason?: string): IRef<T> | null {
    if (this.instances.has(key)) {
      return this.createRef(key, reason);
    }
    return null;
  }


  createRef(key: string, reason?: string) {
    const instance: T = this.instances.get(key)!;
    const ref = new Ref<T>(instance, reason, (reason?: string) => {
      return this.createRef(key, reason);
    });
    ref.addDispose({
      dispose: () => {
        this.removeRef(key, ref);
      }
    })
    this.addRef(key, ref);
    return ref;
  }
  

  private addRef(key: string , ref: Ref<T>) {
    if (!this.refs.get(key)){
      this.refs.set(key, []);
    }
    this.refs.get(key)!.push(ref);
  }

  private removeRef(key: string, ref: Ref<T> | undefined) {
    if (this.refs.get(key)){
      if (ref) {
        const index = this.refs.get(key)!.indexOf(ref);
        if (index !== -1) {
          this.refs.get(key)!.splice(index,1);
        }
      }
      if (this.refs.get(key)!.length === 0) {
        if (this._creating.has(key)) {
          return; // 正在被创建
        }
        this.refs.delete(key);
        this.instances.delete(key);
        this._onReferenceAllDisposed.fire(key);
      }
    }
  }

}

export class Ref<T> extends Disposable implements IRef<T> {

  constructor(private _instance: T | null, public readonly reason: string | undefined, private _clone: null | ((reason?: string) => Ref<T> )) {
    super();
    this.addDispose({
      dispose: () => {
        this._instance = null;
        this._clone = null;
      }
    });
  }

  get instance() {
    if (this.disposed) {
      throw new Error('Ref has been disposed!')
    }
    return this._instance!;
  }

  hold(reason?: string): Ref<T> {
    if (this.disposed) {
      throw new Error('Ref has been disposed!')
    }
    return this._clone!(reason);
  }

}
