import { IProgress } from '.';

export class Progress<T> implements IProgress<T> {

  static readonly None: IProgress<unknown> = Object.freeze({ report() { } });

  private _value?: T;
  get value(): T | undefined { return this._value; }

  constructor(private callback: (data: T) => void) { }

  report(item: T) {
    this._value = item;
    this.callback(this._value);
  }
}
