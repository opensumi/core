import { Barrier } from '@opensumi/ide-core-common';

export abstract class BaseContextKey {
  protected abstract initScopedContext(dom: HTMLDivElement): void;

  protected barrier = new Barrier();

  get isReady(): boolean {
    return this.barrier.isOpen();
  }

  async whenReady(): Promise<void> {
    await this.barrier.wait();
  }

  init(dom: HTMLDivElement) {
    this.initScopedContext(dom);
    this.barrier.open();
  }
}
