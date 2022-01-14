import type vscode from 'vscode';
import {
  Event,
  Emitter,
  getDebugLogger,
  isUndefined,
  DisposableStore,
  IDisposable,
  Deferred,
  Disposable,
  CancellationTokenSource,
} from '@opensumi/ide-core-common';
import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  ITerminalInfo,
  TerminalDataBufferer,
  ITerminalChildProcess,
  ITerminalDimensionsOverride,
  ITerminalDimensionsDto,
  ITerminalLaunchError,
  ITerminalExitEvent,
  ITerminalLinkDto,
  ICreateContributedTerminalProfileOptions,
  ITerminalProfile,
} from '@opensumi/ide-terminal-next';
import {
  IMainThreadTerminal,
  MainThreadAPIIdentifier,
  IExtHostTerminal,
  IExtensionDescription,
} from '../../../common/vscode';
import { userInfo } from 'os';
import { IExtension } from '../../../common';
import {
  EnvironmentVariableMutatorType,
  ISerializableEnvironmentVariableCollection,
} from '@opensumi/ide-terminal-next/lib/common/environmentVariable';

const debugLog = getDebugLogger();

let nextLinkId = 1;

interface ICachedLinkEntry {
  provider: vscode.TerminalLinkProvider;
  link: vscode.TerminalLink;
}

export class ExtHostTerminal implements IExtHostTerminal {
  private proxy: IMainThreadTerminal;
  private changeActiveTerminalEvent: Emitter<Terminal | undefined> = new Emitter();
  private closeTerminalEvent: Emitter<Terminal> = new Emitter();
  private openTerminalEvent: Emitter<Terminal> = new Emitter();
  private terminalsMap: Map<string, Terminal> = new Map();
  private _terminalDeferreds: Map<string, Deferred<Terminal | undefined>> = new Map();
  private readonly _linkProviders: Set<vscode.TerminalLinkProvider> = new Set();
  private readonly _terminalLinkCache: Map<string, Map<number, ICachedLinkEntry>> = new Map();
  private readonly _terminalLinkCancellationSource: Map<string, CancellationTokenSource> = new Map();
  private readonly _profileProviders: Map<string, vscode.TerminalProfileProvider> = new Map();

  private _defaultProfile: ITerminalProfile | undefined;
  private _defaultAutomationProfile: ITerminalProfile | undefined;

  private environmentVariableCollections: Map<string, EnvironmentVariableCollection> = new Map();

  private disposables: DisposableStore = new DisposableStore();

  private readonly _bufferer: TerminalDataBufferer;
  protected _terminalProcesses: Map<string, ITerminalChildProcess> = new Map();
  protected _terminalProcessDisposables: { [id: number]: IDisposable } = {};
  protected _extensionTerminalAwaitingStart: {
    [id: number]: { initialDimensions: ITerminalDimensionsDto | undefined } | undefined;
  } = {};

  activeTerminal: Terminal | undefined;
  get terminals(): Terminal[] {
    return Array.from(this.terminalsMap.values());
  }

  constructor(rpcProtocol: IRPCProtocol) {
    this.proxy = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadTerminal);
    this._bufferer = new TerminalDataBufferer(this.proxy.$sendProcessData);
  }

  $onDidChangeActiveTerminal(id: string) {
    const terminal = this.terminalsMap.get(id);
    if (terminal) {
      this.activeTerminal = terminal;
      this.changeActiveTerminalEvent.fire(terminal);
    } else {
      debugLog.error('[onDidChangeActiveTerminal] cannot find terminal with id: ' + id);
    }
  }

  get onDidChangeActiveTerminal(): Event<Terminal | undefined> {
    return this.changeActiveTerminalEvent.event;
  }

  $onDidCloseTerminal(e: ITerminalExitEvent) {
    const terminal = this.terminalsMap.get(e.id);
    if (!terminal) {
      return debugLog.error('没有找到终端');
    }

    terminal.setExitCode(e.code);
    this.closeTerminalEvent.fire(terminal);

    this.terminalsMap.delete(e.id);
  }

  get onDidCloseTerminal(): Event<Terminal> {
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

  get onDidOpenTerminal(): Event<Terminal> {
    return this.openTerminalEvent.event;
  }

  get shellPath() {
    return this._defaultProfile?.path || process.env.SHELL || userInfo().shell;
  }

  createTerminal(name?: string, shellPath?: string, shellArgs?: string[] | string): vscode.Terminal {
    const terminal = new Terminal(name || '', { name, shellPath, shellArgs }, this.proxy);
    terminal
      .create({
        name,
        shellPath,
        shellArgs,
      })
      .then((id) => {
        this.terminalsMap.set(id, terminal);
      });
    return terminal;
  }

  createTerminalFromOptions(options: vscode.TerminalOptions) {
    // 插件API 同步提供 terminal 实例
    const terminal = new Terminal(options.name, options, this.proxy);
    terminal.create(options).then((id) => {
      this.terminalsMap.set(id, terminal);
    });
    return terminal;
  }

  createExtensionTerminal(options: vscode.ExtensionTerminalOptions) {
    const terminal = new Terminal(options.name, options, this.proxy);
    const p = new ExtHostPseudoterminal(options.pty);
    terminal.createExtensionTerminal().then((id) => {
      const disposable = this._setupExtHostProcessListeners(id, p);

      this.terminalsMap.set(id, terminal);

      this._terminalProcessDisposables[id] = disposable;
    });

    this.disposables.add(
      p.onProcessExit((e: number | undefined) => {
        terminal.setExitCode(e);
      }),
    );

    return terminal;
  }

  public attachPtyToTerminal(id: string, pty: vscode.Pseudoterminal) {
    const terminal = this._getTerminalByIdEventually(id);
    if (!terminal) {
      throw new Error(`Cannot resolve terminal with id ${id} for virtual process`);
    }
    const p = new ExtHostPseudoterminal(pty);
    this._setupExtHostProcessListeners(id, p);
  }

  $setTerminals(idList: ITerminalInfo[]) {
    this.terminalsMap.clear();
    this.activeTerminal = undefined;
    idList.forEach((info: ITerminalInfo) => {
      if (this.terminalsMap.get(info.id)) {
        return;
      }
      const terminal = new Terminal(info.name, info, this.proxy, info.id);
      if (info.isActive) {
        this.activeTerminal = terminal;
      }
      if (this.terminalsMap.get(info.id)) {
        return;
      }
      this.terminalsMap.set(info.id, terminal);
    });
  }

  registerLinkProvider(provider: vscode.TerminalLinkProvider): IDisposable {
    this._linkProviders.add(provider);
    if (this._linkProviders.size === 1) {
      this.proxy.$startLinkProvider();
    }
    return Disposable.create(() => {
      this._linkProviders.delete(provider);
      if (this._linkProviders.size === 0) {
        this.proxy.$stopLinkProvider();
      }
    });
  }

  async $provideLinks(terminalId: string, line: string): Promise<ITerminalLinkDto[]> {
    const terminal = this.terminalsMap.get(terminalId);
    if (!terminal) {
      return [];
    }

    // Discard any cached links the terminal has been holding, currently all links are released
    // when new links are provided.
    this._terminalLinkCache.delete(terminalId);

    const oldToken = this._terminalLinkCancellationSource.get(terminalId);
    if (oldToken) {
      oldToken.dispose(true);
    }
    const cancellationSource = new CancellationTokenSource();
    this._terminalLinkCancellationSource.set(terminalId, cancellationSource);

    const result: ITerminalLinkDto[] = [];
    const context: vscode.TerminalLinkContext = { terminal, line };
    const promises: vscode.ProviderResult<{ provider: vscode.TerminalLinkProvider; links: vscode.TerminalLink[] }>[] =
      [];

    for (const provider of this._linkProviders) {
      promises.push(
        new Promise(async (r) => {
          cancellationSource.token.onCancellationRequested(() => r({ provider, links: [] }));
          const links = (await provider.provideTerminalLinks(context, cancellationSource.token)) || [];
          if (!cancellationSource.token.isCancellationRequested) {
            r({ provider, links });
          }
        }),
      );
    }

    const provideResults = await Promise.all(promises);

    if (cancellationSource.token.isCancellationRequested) {
      return [];
    }

    const cacheLinkMap = new Map<number, ICachedLinkEntry>();
    for (const provideResult of provideResults) {
      if (provideResult && provideResult.links.length > 0) {
        result.push(
          ...provideResult.links.map((providerLink) => {
            const link = {
              id: nextLinkId++,
              startIndex: providerLink.startIndex,
              length: providerLink.length,
              label: providerLink.tooltip,
            };
            cacheLinkMap.set(link.id, {
              provider: provideResult.provider,
              link: providerLink,
            });
            return link;
          }),
        );
      }
    }

    this._terminalLinkCache.set(terminalId, cacheLinkMap);

    return result;
  }

  $activateLink(terminalId: string, linkId: number): void {
    const cachedLink = this._terminalLinkCache.get(terminalId)?.get(linkId);
    if (!cachedLink) {
      return;
    }
    cachedLink.provider.handleTerminalLink(cachedLink.link);
  }

  dispose() {
    this.changeActiveTerminalEvent.dispose();
    this.closeTerminalEvent.dispose();
    this.openTerminalEvent.dispose();
    this.disposables.dispose();
  }

  registerTerminalProfileProvider(
    extension: IExtensionDescription,
    id: string,
    provider: vscode.TerminalProfileProvider,
  ): IDisposable {
    if (this._profileProviders.has(id)) {
      throw new Error(`Terminal profile provider "${id}" already registered`);
    }
    this._profileProviders.set(id, provider);
    this.proxy.$registerProfileProvider(id, extension.identifier.value);
    return Disposable.create(() => {
      this._profileProviders.delete(id);
      this.proxy.$unregisterProfileProvider(id);
    });
  }

  public $acceptDefaultProfile(profile: ITerminalProfile, automationProfile?: ITerminalProfile): void {
    this._defaultProfile = profile;
    // 还不知道这个 automation 有啥用
    this._defaultAutomationProfile = automationProfile;
  }

  public async $createContributedProfileTerminal(
    id: string,
    options: ICreateContributedTerminalProfileOptions,
  ): Promise<void> {
    const token = new CancellationTokenSource().token;
    let profile = await this._profileProviders.get(id)?.provideTerminalProfile(token);
    if (token.isCancellationRequested) {
      return;
    }
    if (profile && !('options' in profile)) {
      profile = { options: profile };
    }

    if (!profile || !('options' in profile)) {
      throw new Error(`No terminal profile options provided for id "${id}"`);
    }

    if ('pty' in profile.options) {
      // TODO: 传入第二个参数
      // this.createExtensionTerminal(profile.options, options);
      this.createExtensionTerminal(profile.options);
      return;
    }
    // TODO: 传入第二个参数
    // this.createTerminalFromOptions(profile.options, options);
    this.createTerminalFromOptions(profile.options);
  }

  private async _getTerminalByIdEventually(id: string, timeout = 1000) {
    let terminal = this.terminalsMap.get(id);
    if (!terminal) {
      const deferred = this._terminalDeferreds.get(id) || new Deferred<Terminal | undefined>();
      setTimeout(() => {
        deferred.resolve(terminal);
      }, timeout);

      this._terminalDeferreds.set(id, deferred);
      terminal = await deferred.promise;
      this._terminalDeferreds.delete(id);
    }
    return terminal;
  }

  public async $startExtensionTerminal(
    id: string,
    initialDimensions: ITerminalDimensionsDto | undefined,
  ): Promise<ITerminalLaunchError | undefined> {
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

    disposables.add(
      p.onProcessReady((e: { pid: number; cwd: string }) => this.proxy.$sendProcessReady(id, e.pid, e.cwd)),
    );
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
    this._terminalProcesses
      .get(id)
      ?.getInitialCwd()
      .then((initialCwd) => this.proxy.$sendProcessInitialCwd(id, initialCwd));
  }

  public $acceptProcessRequestCwd(id: string): void {
    this._terminalProcesses
      .get(id)
      ?.getCwd()
      .then((cwd) => this.proxy.$sendProcessCwd(id, cwd));
  }

  public $acceptTerminalTitleChange(terminalId: string, name: string) {
    const terminal = this.terminalsMap.get(terminalId);

    if (terminal) {
      terminal.setName(name);
    }
  }

  getEnviromentVariableCollection(extension: IExtension) {
    let collection = this.environmentVariableCollections.get(extension.id);
    if (!collection) {
      collection = new EnvironmentVariableCollection();
      this._setEnvironmentVariableCollection(extension.id, collection);
    }
    return collection;
  }

  private syncEnvironmentVariableCollection(
    extensionIdentifier: string,
    collection: EnvironmentVariableCollection,
  ): void {
    const serialized = [...collection.map.entries()];
    this.proxy.$setEnvironmentVariableCollection(
      extensionIdentifier,
      collection.persistent,
      serialized.length === 0 ? undefined : serialized,
    );
  }

  private _setEnvironmentVariableCollection(
    extensionIdentifier: string,
    collection: EnvironmentVariableCollection,
  ): void {
    this.environmentVariableCollections.set(extensionIdentifier, collection);
    collection.onDidChangeCollection(() => {
      // When any collection value changes send this immediately, this is done to ensure
      // following calls to createTerminal will be created with the new environment. It will
      // result in more noise by sending multiple updates when called but collections are
      // expected to be small.
      this.syncEnvironmentVariableCollection(extensionIdentifier, collection);
    });
  }
}

/**
 * EnvironmentVariableCollection
 * Some code copied and modified from
 * https://github.com/microsoft/vscode/blob/1.55.0/src/vs/workbench/api/common/extHostTerminalService.ts#L696
 */
export class EnvironmentVariableCollection implements vscode.EnvironmentVariableCollection {
  readonly map: Map<string, vscode.EnvironmentVariableMutator> = new Map();

  protected readonly _onDidChangeCollection: Emitter<void> = new Emitter<void>();
  get onDidChangeCollection(): Event<void> {
    return this._onDidChangeCollection && this._onDidChangeCollection.event;
  }

  constructor(serialized?: ISerializableEnvironmentVariableCollection) {
    this.map = new Map(serialized);
  }

  private _persistent = true;

  public get persistent(): boolean {
    return this._persistent;
  }

  public set persistent(value: boolean) {
    this._persistent = value;
    this._onDidChangeCollection.fire();
  }

  private _setIfDiffers(variable: string, mutator: vscode.EnvironmentVariableMutator): void {
    const current = this.map.get(variable);
    if (!current || current.value !== mutator.value || current.type !== mutator.type) {
      this.map.set(variable, mutator);
      this._onDidChangeCollection.fire();
    }
  }

  replace(variable: string, value: string): void {
    this._setIfDiffers(variable, { value, type: EnvironmentVariableMutatorType.Replace });
  }

  append(variable: string, value: string): void {
    this._setIfDiffers(variable, { value, type: EnvironmentVariableMutatorType.Append });
  }

  prepend(variable: string, value: string): void {
    this._setIfDiffers(variable, { value, type: EnvironmentVariableMutatorType.Prepend });
  }

  get(variable: string): vscode.EnvironmentVariableMutator | undefined {
    return this.map.get(variable);
  }

  forEach(
    callback: (
      variable: string,
      mutator: vscode.EnvironmentVariableMutator,
      collection: vscode.EnvironmentVariableCollection,
    ) => any,
    thisArg?: any,
  ): void {
    this.map.forEach((value, key) => callback.call(thisArg, key, value, this));
  }

  delete(variable: string): void {
    this.map.delete(variable);
    this._onDidChangeCollection.fire();
  }

  clear(): void {
    this.map.clear();
    this._onDidChangeCollection.fire();
  }
}

export class Terminal implements vscode.Terminal {
  private id: string;

  public __id: string;

  private _exitStatus: vscode.TerminalExitStatus | undefined;

  private createdPromiseResolve;

  private when: Promise<any> = new Promise((resolve) => {
    this.createdPromiseResolve = resolve;
  });

  constructor(
    private _name: string = '',
    private readonly _creationOptions: vscode.TerminalOptions | vscode.ExtensionTerminalOptions,
    protected proxy: IMainThreadTerminal,
    id?: string,
  ) {
    if (!isUndefined(id)) {
      this.created(id);
    }
  }

  get name() {
    return this._name;
  }

  get exitStatus() {
    return this._exitStatus;
  }

  get processId(): Thenable<number> {
    return this.when.then(() => this.proxy.$getProcessId(this.id));
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

  async create(options: vscode.TerminalOptions): Promise<string> {
    const id = await this.proxy.$createTerminal(options);

    if (!id) {
      throw new Error('createExtensionTerminal error');
    }

    this.created(id);

    return id;
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
    if (!id) {
      // 这种情况应该是不会发生的，加个判断安全
      throw new Error('createExtensionTerminal error');
    }
    this.created(id);
    return id;
  }

  public setExitCode(code: number | undefined) {
    this._exitStatus = Object.freeze({ code });
  }

  public setName(name: string) {
    this._name = name;
  }
}

export class ExtHostPseudoterminal implements ITerminalChildProcess {
  private readonly _onProcessData = new Emitter<string>();
  public readonly onProcessData: Event<string> = this._onProcessData.event;
  private readonly _onProcessExit = new Emitter<number | undefined>();
  public readonly onProcessExit: Event<number | undefined> = this._onProcessExit.event;
  private readonly _onProcessReady = new Emitter<{ pid: number; cwd: string }>();
  public get onProcessReady(): Event<{ pid: number; cwd: string }> {
    return this._onProcessReady.event;
  }
  private readonly _onProcessTitleChanged = new Emitter<string>();
  public readonly onProcessTitleChanged: Event<string> = this._onProcessTitleChanged.event;
  private readonly _onProcessOverrideDimensions = new Emitter<ITerminalDimensionsOverride | undefined>();
  public get onProcessOverrideDimensions(): Event<ITerminalDimensionsOverride | undefined> {
    return this._onProcessOverrideDimensions.event;
  }

  constructor(private readonly _pty: vscode.Pseudoterminal) {}

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
      this._pty.onDidOverrideDimensions((e) =>
        this._onProcessOverrideDimensions.fire(e ? { cols: e.columns, rows: e.rows } : e),
      );
    }

    if (this._pty.onDidChangeName) {
      this._pty.onDidChangeName((title) => this._onProcessTitleChanged.fire(title));
    }

    this._pty.open(initialDimensions ? initialDimensions : undefined);
    this._onProcessReady.fire({ pid: -1, cwd: '' });
  }
}
