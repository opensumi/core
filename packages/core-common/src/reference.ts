import { IDisposable, Disposable } from './disposable';

export interface Ref<T> {
  instance: T;
  dispose(): void;
}

export interface IDisposableRef<T> extends IDisposable {
  ref: symbol;
  toReference(): Ref<T>;
}

export class RefernceManager extends Disposable {
  private _collections: Map<symbol, number>;
  private _ref2Instace: Map<symbol, IDisposableRef<any>>;

  static singleton: RefernceManager;

  static share() {
    if (!RefernceManager.singleton) {
      RefernceManager.singleton = new RefernceManager();
    }
    return RefernceManager.singleton;
  }

  constructor() {
    super();
    this._collections = new Map();
    this._ref2Instace = new Map();

    this.addDispose({
      dispose: () => {
        this._collections.clear();

        // @ts-ignore
        this._collections = null;
      }
    });
  }

  register<T>(instance: IDisposableRef<T>) {
    this._ref2Instace.set(instance.ref, instance);
  }

  add(ref: symbol) {
    const count = this._collections.get(ref) || 0;
    this._collections.set(ref, count + 1);
  }

  del(ref: symbol): boolean {
    const count = this._collections.get(ref) || 0;

    if (count > 1) {
      this._collections.set(ref, count - 1);
      return false;
    } else {
      this._collections.delete(ref);
      return true;
    }
  }
}

export class DisposableRef<T> extends Disposable implements IDisposableRef<T> {
  private _ref = Symbol('DisposeSymbol');
  private _referenceManager = RefernceManager.share();

  constructor() {
    super();
    this._referenceManager.register(this);
  }

  get ref() {
    return this._ref;
  }

  hold() {
    this._referenceManager.add(this._ref);
  }

  dispose() {
    const needDispose = this._referenceManager.del(this._ref);
    if (needDispose) {
      super.dispose();
    }
  }

  toReference(): Ref<T> {
    return {
      instance: (this as any),
      dispose: () => this.dispose(),
    };
  }
}
