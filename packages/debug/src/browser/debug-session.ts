import {
  Emitter,
  Event,
  URI,
  DisposableCollection,
} from '@ali/ide-core-browser';

export class DebugSession {

  protected readonly onDidChangeEmitter = new Emitter<void>();
  readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;
  protected fireDidChange(): void {
    this.onDidChangeEmitter.fire(undefined);
  }

  // 断点改变事件
  protected readonly onDidChangeBreakpointsEmitter = new Emitter<URI>();
  readonly onDidChangeBreakpoints: Event<URI> = this.onDidChangeBreakpointsEmitter.event;
  protected fireDidChangeBreakpoints(uri: URI): void {
    this.onDidChangeBreakpointsEmitter.fire(uri);
  }

  protected readonly toDispose = new DisposableCollection();

}
