import type vscode from 'vscode';

import { Event, IDisposable, URI } from '@opensumi/ide-core-common';

export interface IProcessDataEvent {
  data: string;
  sync: boolean;
}

interface TerminalDataBuffer extends IDisposable {
  data: string[];
  timeoutId: any;
}

export class TerminalDataBufferer implements IDisposable {
  private readonly _terminalBufferMap = new Map<string, TerminalDataBuffer>();

  constructor(private readonly _callback: (id: string, data: string) => void) {}

  dispose() {
    for (const buffer of this._terminalBufferMap.values()) {
      buffer.dispose();
    }
  }

  startBuffering(id: string, event: Event<string | IProcessDataEvent>, throttleBy = 5): IDisposable {
    let disposable: IDisposable;
    disposable = event((e: string | IProcessDataEvent) => {
      const data = typeof e === 'string' ? e : e.data;
      let buffer = this._terminalBufferMap.get(id);
      if (buffer) {
        buffer.data.push(data);
        return;
      }

      const timeoutId = setTimeout(() => this._flushBuffer(id), throttleBy);
      buffer = {
        data: [data],
        timeoutId,
        dispose: () => {
          clearTimeout(timeoutId);
          this._flushBuffer(id);
          disposable.dispose();
        },
      };
      this._terminalBufferMap.set(id, buffer);
    });
    return disposable;
  }

  stopBuffering(id: string) {
    const buffer = this._terminalBufferMap.get(id);
    if (buffer) {
      buffer.dispose();
    }
  }

  private _flushBuffer(id: string): void {
    const buffer = this._terminalBufferMap.get(id);
    if (buffer) {
      this._terminalBufferMap.delete(id);
      this._callback(id, buffer.data.join(''));
    }
  }
}

export interface ITerminalDimensions {
  /**
   * The columns of the terminal.
   */
  readonly cols: number;

  /**
   * The rows of the terminal.
   */
  readonly rows: number;
}

export interface ITerminalDimensionsOverride extends ITerminalDimensions {
  /**
   * indicate that xterm must receive these exact dimensions, even if they overflow the ui!
   */
  forceExactSize?: boolean;
}

export interface ITerminalDimensionsDto {
  columns: number;
  rows: number;
}

export interface ITerminalLinkDto {
  /** The ID of the link to enable activation and disposal. */
  id: number;
  /** The startIndex of the link in the line. */
  startIndex: number;
  /** The length of the link in the line. */
  length: number;
  /** The descriptive label for what the link does when activated. */
  label?: string;
}

export interface ITerminalLaunchError {
  message: string;
}

/**
 * An interface representing a raw terminal child process, this contains a subset of the
 * child_process.ChildProcess node.js interface.
 */
export interface ITerminalChildProcess {
  onProcessData: Event<IProcessDataEvent | string>;
  onProcessExit: Event<number | undefined>;
  onProcessReady: Event<{ pid: number; cwd: string }>;
  onProcessTitleChanged: Event<string>;
  onProcessOverrideDimensions?: Event<ITerminalDimensionsOverride | undefined>;
  onProcessResolvedShellLaunchConfig?: Event<vscode.TerminalOptions>;

  /**
   * Starts the process.
   *
   * @returns undefined when the process was successfully started, otherwise an object containing
   * information on what went wrong.
   */
  start(): Promise<ITerminalLaunchError | undefined>;

  /**
   * Shutdown the terminal process.
   *
   * @param immediate When true the process will be killed immediately, otherwise the process will
   * be given some time to make sure no additional data comes through.
   */
  shutdown(immediate: boolean): void;
  input(data: string): void;
  resize(cols: number, rows: number): void;

  getInitialCwd(): Promise<string>;
  getCwd(): Promise<string>;
  getLatency(): Promise<number>;
}

export interface ITerminalProcessExtHostProxy extends IDisposable {
  readonly terminalId: string;

  emitData(data: string): void;
  emitTitle(title: string): void;
  emitReady(pid: number, cwd: string): void;
  emitExit(exitCode: number | undefined): void;
  emitOverrideDimensions(dimensions: ITerminalDimensions | undefined): void;
  emitInitialCwd(initialCwd: string): void;
  emitCwd(cwd: string): void;
  emitLatency(latency: number): void;

  onInput: Event<string>;
  onResize: Event<{ cols: number; rows: number }>;
  onShutdown: Event<boolean>;
  onRequestInitialCwd: Event<void>;
  onRequestCwd: Event<void>;
  onRequestLatency: Event<void>;
}

export interface IStartExtensionTerminalRequest {
  proxy: ITerminalProcessExtHostProxy;
  cols: number;
  rows: number;
  callback: (error: ITerminalLaunchError | undefined) => void;
}

export interface ITerminalProfileProvider {
  createContributedTerminalProfile(options: ICreateContributedTerminalProfileOptions): Promise<void>;
}

export interface ICreateContributedTerminalProfileOptions {
  icon?: URI | string | { light: URI; dark: URI };
  color?: string;
  location?: TerminalLocation | { viewColumn: number; preserveState?: boolean } | { splitActiveTerminal: boolean };
}

export enum TerminalLocation {
  Panel = 1,
  Editor = 2,
}

export const enum TerminalLocationString {
  TerminalView = 'view',
  Editor = 'editor',
}

export interface ITerminalEnvironment {
  [key: string]: string | null | undefined;
}
