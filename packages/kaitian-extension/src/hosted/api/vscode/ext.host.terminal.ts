import type * as vscode from 'vscode';
import { Event, Emitter, getDebugLogger, isUndefined, DisposableStore, IDisposable, Deferred } from '@ali/ide-core-common';
import { IRPCProtocol } from '@ali/ide-connection';
import { ITerminalInfo, TerminalDataBufferer, ITerminalChildProcess, ITerminalDimensionsOverride, ITerminalDimensionsDto, ITerminalLaunchError } from '@ali/ide-terminal-next';
import { IMainThreadTerminal, MainThreadAPIIdentifier, IExtHostTerminal } from '../../../common/vscode';

const debugLog = getDebugLogger();

export class ExtHostTerminal implements IExtHostTerminal {
  private proxy: IMainThreadTerminal;
  private changeActiveTerminalEvent: Emitter<vscode.Terminal | undefined> = new Emitter();
  private closeTerminalEvent: Emitter<vscode.Terminal> = new Emitter();
  private openTerminalEvent: Emitter<vscode.Terminal> = new Emitter();
  private terminalsMap: Map<string, vscode.Terminal> = new Map();
  private _terminalDeferreds: Map<string, Deferred<vscode.Terminal>> = new Map();

  private _shellPath: string;

  private readonly _bufferer: TerminalDataBufferer;
  protected _terminalProcesses: Map<string, ITerminalChildProcess> = new Map();
  protected _terminalProcessDisposables: { [id: number]: IDisposable } = {};
  protected _extensionTerminalAwaitingStart: { [id: number]: { initialDimensions: ITerminalDimensionsDto | undefined } | undefined } = {};

  activeTerminal: vscode.Terminal | undefined;
  get terminals(): vscode.Terminal[] {
    return Array.from(this.terminalsMap.values());
  }

  constructor(rpcProtocol: IRPCProtocol) {
    this.proxy = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadTerminal);
    this._bufferer = new TerminalDataBufferer(this.proxy.$sendProcessData);
  }

  $onDidChangeActiveTerminal(id: string) {
    const terminal = this.terminalsMap.get(id);
    this.activeTerminal = terminal!;
    this.changeActiveTerminalEvent.fire(terminal);
  }

  get onDidChangeActiveTerminal(): Event<vscode.Terminal | undefined>  {
    return this.changeActiveTerminalEvent.event;
  }

  $onDidCloseTerminal(id: string) {
    const terminal = this.terminalsMap.get(id);
    if (!terminal) {
      return debugLog.error('没有找到终端');
    }
    this.terminalsMap.delete(id);
    this.closeTerminalEvent.fire(terminal);
  }

  get onDidCloseTerminal(): Event<vscode.Terminal> {
    return this.closeTerminalEvent.event;
  }

  $onDidOpenTerminal(info: ITerminalInfo) {
    let terminal = this.terminalsMap.get(info.id);

    if (!terminal) {
      terminal = new Terminal(info.name, info, this.proxy, info.id);
      this.terminalsMap.set(info.id, terminal);
      const deferred = this._terminalDeferreds.get(info.id);
      deferred?.resolve(terminal);
    }
    this.openTerminalEvent.fire(terminal);
  }

  get onDidOpenTerminal(): Event<vscode.Terminal> {
    return this.openTerminalEvent.event;
  }

  $acceptDefaultShell(shellPath: string) {
    this._shellPath = shellPath;
  }

  get shellPath() {
    return this._shellPath;
  }

  createTerminal(
    name?: string,
    shellPath?: string,
    shellArgs?: string[] | string,
  ): vscode.Terminal {
    const terminal = new Terminal(name || '', { name, shellPath, shellArgs }, this.proxy);
    terminal.create({
      name,
      shellPath,
      shellArgs,
    });
    return terminal;
  }

  createTerminalFromOptions(options: vscode.TerminalOptions) {
    // 插件API 同步提供 terminal 实例
    const terminal = new Terminal(options.name, options, this.proxy);
    terminal.create(options);
    return terminal;
  }

  createExtensionTerminal(options: vscode.ExtensionTerminalOptions) {
    const terminal = new Terminal(options.name, options, this.proxy);
    const p = new ExtHostPseudoterminal(options.pty);
    terminal.createExtensionTerminal().then((id) => {
      const disposable = this._setupExtHostProcessListeners(id, p);
      this._terminalProcessDisposables[id] = disposable;
    });
    return terminal;
  }

  $setTerminals(idList: ITerminalInfo[]) {
    this.terminalsMap.clear();
    this.activeTerminal = undefined;
    idList.forEach((info: ITerminalInfo) => {
      if (this.terminalsMap.get(info.id)) {
        return;
      }
      const terminal =  new Terminal(info.name, info, this.proxy, info.id);
      if (info.isActive) {
        this.activeTerminal = terminal;
      }
      if (this.terminalsMap.get(info.id)) {
        return;
      }
      this.terminalsMap.set(info.id, terminal);
    });
  }

  dispose() {
    this.changeActiveTerminalEvent.dispose();
    this.closeTerminalEvent.dispose();
    this.openTerminalEvent.dispose();
  }

  private async _getTerminalByIdEventually(id: string, timeout = 1000) {
    let terminal = this.terminalsMap.get(id);
    if (!terminal) {
      const deferred = new Deferred<vscode.Terminal>();
      setTimeout(() => {
        deferred.resolve();
      }, timeout);
      this._terminalDeferreds.set(id, deferred);
      terminal = await deferred.promise;
      this._terminalDeferreds.delete(id);
    }
    return terminal;
  }

  public async $startExtensionTerminal(id: string, initialDimensions: ITerminalDimensionsDto | undefined): Promise<ITerminalLaunchError | undefined> {
    // Make sure the ExtHostTerminal exists so onDidOpenTerminal has fired before we call
    // Pseudoterminal.start
    const terminal = await this._getTerminalByIdEventually(id);
    if (!terminal) {
      return { message: `Could not find the terminal with id ${id} on the extension host` };
    }

    // TerminalController::_createClient 会立即触发 onDidOpenTerminal，所以无需等待

    const terminalProcess = this._terminalProcesses.get(id);
    if (terminalProcess) {
      (terminalProcess as ExtHostPseudoterminal).startSendingEvents(initialDimensions);
    } else {
      // Defer startSendingEvents call to when _setupExtHostProcessListeners is called
      this._extensionTerminalAwaitingStart[id] = { initialDimensions };
    }

    return undefined;
  }

  protected _setupExtHostProcessListeners(id: string, p: ITerminalChildProcess): IDisposable {
    const disposables = new DisposableStore();

    disposables.add(p.onProcessReady((e: { pid: number, cwd: string }) => this.proxy.$sendProcessReady(id, e.pid, e.cwd)));
    disposables.add(p.onProcessTitleChanged((title) => this.proxy.$sendProcessTitle(id, title)));

    // Buffer data events to reduce the amount of messages going to the renderer
    this._bufferer.startBuffering(id, p.onProcessData);
    disposables.add(p.onProcessExit((exitCode) => this._onProcessExit(id, exitCode)));

    if (p.onProcessOverrideDimensions) {
      disposables.add(p.onProcessOverrideDimensions((e) => this.proxy.$sendOverrideDimensions(id, e)));
    }
    this._terminalProcesses.set(id, p);

    const awaitingStart = this._extensionTerminalAwaitingStart[id];
    if (awaitingStart && p instanceof ExtHostPseudoterminal) {
      p.startSendingEvents(awaitingStart.initialDimensions);
      delete this._extensionTerminalAwaitingStart[id];
    }

    return disposables;
  }

  private _onProcessExit(id: string, exitCode: number | undefined): void {
    this._bufferer.stopBuffering(id);

    // Remove process reference
    this._terminalProcesses.delete(id);
    delete this._extensionTerminalAwaitingStart[id];

    // Clean up process disposables
    const processDiposable = this._terminalProcessDisposables[id];
    if (processDiposable) {
      processDiposable.dispose();
      delete this._terminalProcessDisposables[id];
    }

    // Send exit event to main side
    this.proxy.$sendProcessExit(id, exitCode);
  }

  public $acceptProcessInput(id: string, data: string): void {
    this._terminalProcesses.get(id)?.input(data);
  }

  public $acceptProcessShutdown(id: string, immediate: boolean): void {
    this._terminalProcesses.get(id)?.shutdown(immediate);
  }

  public $acceptProcessRequestInitialCwd(id: string): void {
    this._terminalProcesses.get(id)?.getInitialCwd().then((initialCwd) => this.proxy.$sendProcessInitialCwd(id, initialCwd));
  }

  public $acceptProcessRequestCwd(id: string): void {
    this._terminalProcesses.get(id)?.getCwd().then((cwd) => this.proxy.$sendProcessCwd(id, cwd));
  }
}

export class Terminal implements vscode.Terminal {
  private id: string;

  // tslint:disable-next-line: variable-name
  public __id: string;

  private createdPromiseResolve;

  private when: Promise<any> = new Promise((resolve) => {
    this.createdPromiseResolve = resolve;
  });

  constructor(
    public readonly name: string = '',
    private readonly _creationOptions: vscode.TerminalOptions | vscode.ExtensionTerminalOptions,
    protected proxy: IMainThreadTerminal,
    id?: string,
  ) {
    if (!isUndefined(id)) {
      this.created(id);
    }
  }

  get processId(): Thenable<number> {
    return this.when.then(() => {
      return this.proxy.$getProcessId(this.id);
    });
  }

  public get creationOptions(): Readonly<vscode.TerminalOptions | vscode.ExtensionTerminalOptions> {
    return this._creationOptions;
  }

  sendText(text: string, addNewLine?: boolean): void {
    this.when.then(() => {
      this.proxy.$sendText(this.id, text, addNewLine);
    });
  }

  show(preserveFocus?: boolean): void {
    this.when.then(() => {
      this.proxy.$show(this.id, preserveFocus);
    });
  }

  hide(): void {
    this.when.then(() => {
      this.proxy.$hide(this.id);
    });
  }

  create(options: vscode.TerminalOptions) {
    this.proxy.$createTerminal(options).then((id) => {
      this.created(id);
    });
  }

  created(id) {
    this.id = id;
    this.__id = id;
    this.createdPromiseResolve();
  }

  dispose(): void {
    this.proxy.$dispose(this.id);
  }

  async createExtensionTerminal(): Promise<string> {
    const id = await this.proxy.$createTerminal({ name: this.name, isExtensionTerminal: true });
    this.created(id);
    return id;
  }
}

export class ExtHostPseudoterminal implements ITerminalChildProcess {
  private readonly _onProcessData = new Emitter<string>();
  public readonly onProcessData: Event<string> = this._onProcessData.event;
  private readonly _onProcessExit = new Emitter<number | undefined>();
  public readonly onProcessExit: Event<number | undefined> = this._onProcessExit.event;
  private readonly _onProcessReady = new Emitter<{ pid: number, cwd: string }>();
  public get onProcessReady(): Event<{ pid: number, cwd: string }> { return this._onProcessReady.event; }
  private readonly _onProcessTitleChanged = new Emitter<string>();
  public readonly onProcessTitleChanged: Event<string> = this._onProcessTitleChanged.event;
  private readonly _onProcessOverrideDimensions = new Emitter<ITerminalDimensionsOverride | undefined>();
  public get onProcessOverrideDimensions(): Event<ITerminalDimensionsOverride | undefined> { return this._onProcessOverrideDimensions.event; }

  constructor(private readonly _pty: vscode.Pseudoterminal) { }

  async start(): Promise<undefined> {
    return undefined;
  }

  shutdown(): void {
    this._pty.close();
  }

  input(data: string): void {
    if (this._pty.handleInput) {
      this._pty.handleInput(data);
    }
  }

  resize(cols: number, rows: number): void {
    if (this._pty.setDimensions) {
      this._pty.setDimensions({ columns: cols, rows });
    }
  }

  getInitialCwd(): Promise<string> {
    return Promise.resolve('');
  }

  getCwd(): Promise<string> {
    return Promise.resolve('');
  }

  getLatency(): Promise<number> {
    return Promise.resolve(0);
  }

  startSendingEvents(initialDimensions: ITerminalDimensionsDto | undefined): void {
    // Attach the listeners
    this._pty.onDidWrite((e) => this._onProcessData.fire(e));
    if (this._pty.onDidClose) {
      this._pty.onDidClose((e: number | void = undefined) => {
        this._onProcessExit.fire(e === void 0 ? undefined : e);
      });
    }
    if (this._pty.onDidOverrideDimensions) {
      this._pty.onDidOverrideDimensions((e) => this._onProcessOverrideDimensions.fire(e ? { cols: e.columns, rows: e.rows } : e));
    }

    this._pty.open(initialDimensions ? initialDimensions : undefined);
    this._onProcessReady.fire({ pid: -1, cwd: '' });
  }
}
