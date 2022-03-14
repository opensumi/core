import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';

import {
  ITerminalController,
  ITerminalChildProcess,
  ITerminalProcessExtHostProxy,
  ITerminalDimensionsOverride,
  ITerminalLaunchError,
  ITerminalDimensions,
} from '../common';

export class TerminalProcessExtHostProxy
  extends Disposable
  implements ITerminalChildProcess, ITerminalProcessExtHostProxy
{
  private readonly _onProcessData = this.registerDispose(new Emitter<string>());
  public readonly onProcessData: Event<string> = this._onProcessData.event;
  private readonly _onProcessExit = this.registerDispose(new Emitter<number | undefined>());
  public readonly onProcessExit: Event<number | undefined> = this._onProcessExit.event;
  private readonly _onProcessReady = this.registerDispose(new Emitter<{ pid: number; cwd: string }>());
  public get onProcessReady(): Event<{ pid: number; cwd: string }> {
    return this._onProcessReady.event;
  }
  private readonly _onProcessTitleChanged = this.registerDispose(new Emitter<string>());
  public readonly onProcessTitleChanged: Event<string> = this._onProcessTitleChanged.event;
  private readonly _onProcessOverrideDimensions = this.registerDispose(
    new Emitter<ITerminalDimensionsOverride | undefined>(),
  );
  public get onProcessOverrideDimensions(): Event<ITerminalDimensionsOverride | undefined> {
    return this._onProcessOverrideDimensions.event;
  }

  private readonly _onStart = this.registerDispose(new Emitter<void>());
  public readonly onStart: Event<void> = this._onStart.event;
  private readonly _onInput = this.registerDispose(new Emitter<string>());
  public readonly onInput: Event<string> = this._onInput.event;
  private readonly _onResize: Emitter<{ cols: number; rows: number }> = this.registerDispose(
    new Emitter<{ cols: number; rows: number }>(),
  );
  public readonly onResize: Event<{ cols: number; rows: number }> = this._onResize.event;
  private readonly _onShutdown = this.registerDispose(new Emitter<boolean>());
  public readonly onShutdown: Event<boolean> = this._onShutdown.event;
  private readonly _onRequestInitialCwd = this.registerDispose(new Emitter<void>());
  public readonly onRequestInitialCwd: Event<void> = this._onRequestInitialCwd.event;
  private readonly _onRequestCwd = this.registerDispose(new Emitter<void>());
  public readonly onRequestCwd: Event<void> = this._onRequestCwd.event;
  private readonly _onRequestLatency = this.registerDispose(new Emitter<void>());
  public readonly onRequestLatency: Event<void> = this._onRequestLatency.event;

  private _pendingInitialCwdRequests: ((value: string | PromiseLike<string>) => void)[] = [];
  private _pendingCwdRequests: ((value: string | PromiseLike<string>) => void)[] = [];
  private _pendingLatencyRequests: ((value: number | PromiseLike<number>) => void)[] = [];

  constructor(
    public terminalId: string,
    private _cols: number,
    private _rows: number,
    private readonly controller: ITerminalController,
  ) {
    super();
  }

  public emitData(data: string): void {
    this._onProcessData.fire(data);
  }

  public emitTitle(title: string): void {
    this._onProcessTitleChanged.fire(title);
  }

  public emitReady(pid: number, cwd: string): void {
    this._onProcessReady.fire({ pid, cwd });
  }

  public emitExit(exitCode: number | undefined): void {
    this._onProcessExit.fire(exitCode);
    this.dispose();
  }

  public emitOverrideDimensions(dimensions: ITerminalDimensions | undefined): void {
    this._onProcessOverrideDimensions.fire(dimensions);
  }

  public emitInitialCwd(initialCwd: string): void {
    while (this._pendingInitialCwdRequests.length > 0) {
      this._pendingInitialCwdRequests.pop()!(initialCwd);
    }
  }

  public emitCwd(cwd: string): void {
    while (this._pendingCwdRequests.length > 0) {
      this._pendingCwdRequests.pop()!(cwd);
    }
  }

  public emitLatency(latency: number): void {
    while (this._pendingLatencyRequests.length > 0) {
      this._pendingLatencyRequests.pop()!(latency);
    }
  }

  public async start(): Promise<ITerminalLaunchError | undefined> {
    // 目前仅支持扩展 Terminal
    return this.controller.requestStartExtensionTerminal(this, this._cols, this._rows);
  }

  public shutdown(immediate: boolean): void {
    this._onShutdown.fire(immediate);
  }

  public input(data: string): void {
    this._onInput.fire(data);
  }

  public resize(cols: number, rows: number): void {
    this._onResize.fire({ cols, rows });
  }

  public getInitialCwd(): Promise<string> {
    return new Promise<string>((resolve) => {
      this._onRequestInitialCwd.fire();
      this._pendingInitialCwdRequests.push(resolve);
    });
  }

  public getCwd(): Promise<string> {
    return new Promise<string>((resolve) => {
      this._onRequestCwd.fire();
      this._pendingCwdRequests.push(resolve);
    });
  }

  public getLatency(): Promise<number> {
    return new Promise<number>((resolve) => {
      this._onRequestLatency.fire();
      this._pendingLatencyRequests.push(resolve);
    });
  }
}
