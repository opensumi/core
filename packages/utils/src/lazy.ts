export interface ILazy<T> {
  value: T;
}

class LazyValue<T> implements ILazy<T> {
  private _hasValue: boolean = false;
  private _value?: T;

  constructor(private readonly factory: () => T) {}

  get value(): T {
    if (!this._hasValue) {
      this._hasValue = true;
      this._value = this.factory();
    }
    return this._value!;
  }

  get hasValue(): boolean {
    return this._hasValue;
  }
}

export const lazy = <T>(factory: () => T): LazyValue<T> => new LazyValue<T>(factory);
