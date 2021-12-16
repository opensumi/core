// Modify from @opensumi/ide-core-common/src/disposable.ts
import { Event, Emitter } from './event';

export interface IDisposable {
  /**
   * Dispose this object.
   */
  dispose(): void;
}

export class Disposable implements IDisposable {
  protected readonly disposables: IDisposable[] = [];
  protected readonly onDisposeEmitter = new Emitter<void>();

  constructor(...toDispose: IDisposable[]) {
    toDispose.forEach((d) => this.addDispose(d));
  }

  static create(func: () => void): IDisposable {
    return {
      dispose: func,
    };
  }

  static NULL = Disposable.create(() => {});

  static None = Object.freeze<IDisposable>({ dispose() {} });

  get onDispose(): Event<void> {
    return this.onDisposeEmitter.event;
  }

  protected checkDisposed(): void {
    if (this.disposed && !this.disposingElements) {
      this.onDisposeEmitter.fire(undefined);
    }
  }

  get disposed(): boolean {
    return this.disposables.length === 0;
  }

  private disposingElements = false;
  dispose(): void {
    if (this.disposed || this.disposingElements) {
      return;
    }
    this.disposingElements = true;
    while (!this.disposed) {
      try {
        this.disposables.pop()!.dispose();
      } catch (e) {
        console.error(e);
      }
    }
    this.disposingElements = false;
    this.checkDisposed();
  }

  addDispose(disposable: IDisposable): IDisposable;
  addDispose(disposable: IDisposable[]): IDisposable[];
  addDispose(disposable: IDisposable | IDisposable[]): IDisposable | IDisposable[] {
    if (Array.isArray(disposable)) {
      const disposables = disposable;
      return disposables.map((disposable) => this.addDispose(disposable));
    } else {
      return this.add(disposable);
    }
  }

  protected registerDispose<T extends IDisposable>(disposable: T): T {
    if ((disposable as any as Disposable) === this) {
      throw new Error('Cannot register a disposable on itself!');
    }

    this.add(disposable);
    return disposable;
  }

  private add(disposable: IDisposable): IDisposable {
    const disposables = this.disposables;
    disposables.push(disposable);
    const originalDispose = disposable.dispose.bind(disposable);
    const toRemove = Disposable.create(() => {
      const index = disposables.indexOf(disposable);
      if (index !== -1) {
        disposables.splice(index, 1);
      }
      this.checkDisposed();
    });
    disposable.dispose = () => {
      toRemove.dispose();
      originalDispose();
    };
    return toRemove;
  }
}

export class DisposableCollection implements IDisposable {
  protected readonly disposables: IDisposable[] = [];
  protected readonly onDisposeEmitter = new Emitter<void>();

  constructor(...toDispose: IDisposable[]) {
    toDispose.forEach((d) => this.push(d));
  }

  get onDispose(): Event<void> {
    return this.onDisposeEmitter.event;
  }

  protected checkDisposed(): void {
    if (this.disposed && !this.disposingElements) {
      this.onDisposeEmitter.fire(undefined);
    }
  }

  get disposed(): boolean {
    return this.disposables.length === 0;
  }

  private disposingElements = false;
  dispose(): void {
    if (this.disposed || this.disposingElements) {
      return;
    }
    this.disposingElements = true;
    while (!this.disposed) {
      try {
        this.disposables.pop()!.dispose();
      } catch (e) {
        console.error(e);
      }
    }
    this.disposingElements = false;
    this.checkDisposed();
  }

  push(disposable: IDisposable): IDisposable {
    const disposables = this.disposables;
    disposables.push(disposable);
    const originalDispose = disposable.dispose.bind(disposable);
    const toRemove = Disposable.create(() => {
      const index = disposables.indexOf(disposable);
      if (index !== -1) {
        disposables.splice(index, 1);
      }
      this.checkDisposed();
    });
    disposable.dispose = () => {
      toRemove.dispose();
      originalDispose();
    };
    return toRemove;
  }

  pushAll(disposables: IDisposable[]): IDisposable[] {
    return disposables.map((disposable) => this.push(disposable));
  }
}
