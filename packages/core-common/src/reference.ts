import { MaybePromise } from './async';
import { Disposable } from './disposable';
import { Emitter, Event } from './event';

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

  protected _creating: Map<string, Promise<void>> = new Map();

  constructor(private factory: (key: string) => MaybePromise<T>) {}

  async getReference(key: string, reason?: string): Promise<IRef<T>> {
    if (!this.instances.has(key)) {
      // 由于创建过程可能为异步，此处标注为creating， 防止重复创建。
      if (!this._creating.has(key)) {
        const promise = (async (resolve) => {
          const instance = await this.factory(key);
          this.instances.set(key, instance);
          this._onInstanceCreated.fire(instance);
        })();
        this._creating.set(key, promise);
      }
      try {
        await this._creating.get(key)!;
      } catch (e) {
        // 出错时需要清除创建中状态
        this._creating.delete(key);
        throw e;
      }
    }
    const ref = this.createRef(key, reason);
    // 需要在ref被创建后再结束creating状态，否则如果在onInstanceCreated事件中触发了removeRef至0,
    // 可能导致instance 意外被删除。
    if (this._creating.get(key)) {
      const creatingPromise = this._creating.get(key)!;
      this._creating.delete(key);
      creatingPromise.then(() => {
        // 再触发一次空remove，防止被保护的instance意外残留
        this.removeRef(key, undefined);
      });
    }
    return ref;
  }

  getReferenceIfHasInstance(key: string, reason?: string): IRef<T> | null {
    if (this.instances.has(key)) {
      return this.createRef(key, reason);
    }
    return null;
  }

  private createRef(key: string, reason?: string) {
    const instance: T = this.instances.get(key)!;
    const ref = new Ref<T>(instance, reason, (reason?: string) => this.createRef(key, reason));
    ref.addDispose({
      dispose: () => {
        this.removeRef(key, ref);
      },
    });
    this.addRef(key, ref);
    return ref;
  }

  private addRef(key: string, ref: Ref<T>) {
    if (!this.refs.get(key)) {
      this.refs.set(key, []);
    }
    this.refs.get(key)!.push(ref);
  }

  private removeRef(key: string, ref: Ref<T> | undefined) {
    if (this.refs.get(key)) {
      if (ref) {
        const index = this.refs.get(key)!.indexOf(ref);
        if (index !== -1) {
          this.refs.get(key)!.splice(index, 1);
        }
      }
      if (this.refs.get(key)!.length === 0) {
        if (this._creating.has(key)) {
          return; // 正在被创建， 进行保护
        }
        this.refs.delete(key);
        this.instances.delete(key);
        this._onReferenceAllDisposed.fire(key);
      }
    }
  }
}

export class Ref<T> extends Disposable implements IRef<T> {
  constructor(
    private _instance: T | null,
    public readonly reason: string | undefined,
    private _clone: null | ((reason?: string) => Ref<T>),
  ) {
    super();
    this.addDispose({
      dispose: () => {
        this._instance = null;
        this._clone = null;
      },
    });
  }

  get instance() {
    if (this.disposed) {
      throw new Error('Ref has been disposed!');
    }
    return this._instance!;
  }

  hold(reason?: string): Ref<T> {
    if (this.disposed) {
      throw new Error('Ref has been disposed!');
    }
    return this._clone!(reason);
  }
}
