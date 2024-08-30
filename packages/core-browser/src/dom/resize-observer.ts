import { DisposableStore, Emitter, IDisposable } from '@opensumi/ide-core-common';

import fastdom from './fastdom';

export interface IDimension {
  width: number;
  height: number;
}

export class ResizeObserverWrapper implements IDisposable {
  private _disposables = new DisposableStore();

  private _onDidChange = this._disposables.add(new Emitter<IDimension>());
  public onDidChange = this._onDidChange.event;

  private _resizeObserver: ResizeObserver;

  constructor(private _container: HTMLElement) {
    this._resizeObserver = new ResizeObserver(this._callback);
  }

  private _callback = (entries: ResizeObserverEntry[]) => {
    if (entries[0] && entries[0].contentRect) {
      const width = entries[0].contentRect.width;
      const height = entries[0].contentRect.height;

      this._onDidChange.fire({ width, height });
    }
  };

  private _observed = false;
  observe() {
    if (this._observed) {
      return;
    }
    this._observed = true;

    this._resizeObserver.observe(this._container);
    fastdom.measure(() => {
      this._onDidChange.fire({
        width: this._container.clientWidth,
        height: this._container.clientHeight,
      });
    });
  }

  dispose() {
    this._observed = false;
    this._disposables.dispose();
    this._resizeObserver.disconnect();
  }
}
