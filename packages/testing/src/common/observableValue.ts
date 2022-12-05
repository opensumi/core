import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';

export interface IObservableValue<T> {
  onDidChange: Event<T>;
  readonly value: T;
}

export class ObservableValue<T> extends Disposable implements IObservableValue<T> {
  private readonly changeEmitter = this.registerDispose(new Emitter<T>());

  public readonly onDidChange = this.changeEmitter.event;

  public get value() {
    return this._value;
  }

  public set value(v: T) {
    if (v !== this._value) {
      this._value = v;
      this.changeEmitter.fire(v);
    }
  }

  constructor(private _value: T) {
    super();
  }
}
