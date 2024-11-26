import { userInfo } from 'os';

import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  CancellationTokenSource,
  Deferred,
  Disposable,
  DisposableStore,
  Emitter,
  Event,
  IDisposable,
  MultiKeyMap,
  isUndefined,
  uuid,
} from '@opensumi/ide-core-common';
import {
  ICreateContributedTerminalProfileOptions,
  ITerminalChildProcess,
  ITerminalDimensionsDto,
  ITerminalDimensionsOverride,
  ITerminalExitEvent,
  ITerminalInfo,
  ITerminalLaunchError,
  ITerminalLinkDto,
  ITerminalProfile,
  TERMINAL_ID_SEPARATOR,
  TerminalDataBufferer,
} from '@opensumi/ide-terminal-next';
import {
  EnvironmentVariableMutatorType,
  ISerializableEnvironmentVariableCollection,
} from '@opensumi/ide-terminal-next/lib/common/environmentVariable';

import { IExtension, NO_ROOT_URI } from '../../../common';
import {
  IExtHostTerminal,
  IExtensionDescription,
  IMainThreadTerminal,
  MainThreadAPIIdentifier,
} from '../../../common/vscode';

import type vscode from 'vscode';

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
  private terminalStateChangeEvent: Emitter<Terminal> = new Emitter();
  private terminalsMap: Map<string, Terminal> = new Map();
  private _terminalDeferreds: Map<string, Deferred<Terminal | undefined>> = new Map();
  private readonly _linkProviders: Set<vscode.TerminalLinkProvider> = new Set();
  private readonly _terminalLinkCache: Map<string, Map<number, ICachedLinkEntry>> = new Map();
  private readonly _terminalLinkCancellationSource: Map<string, CancellationTokenSource> = new Map();
  private readonly _profileProviders: Map<string, vscode.TerminalProfileProvider> = new Map();

  private _defaultProfile: ITerminalProfile | undefined;
  private _defaultAutomationProfile: ITerminalProfile | undefined;

  private environmentVariableCollections: MultiKeyMap<string, EnvironmentVariableCollection> = new MultiKeyMap(2);

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

  getTerminal(id: string) {
    if (this.terminalsMap.has(id)) {
      return this.terminalsMap.get(id);
    }
    return this.terminalsMap.get(this.getTerminalShortId(id));
  }

  getTerminalShortId(id: string) {
    // 插件进程创建的 Terminal 可能会在前端被拼接为 `${clientId}${TERMINAL_ID_SEPARATOR}${shortId}` 的形式
    if (id.includes(TERMINAL_ID_SEPARATOR)) {
      return id.split(TERMINAL_ID_SEPARATOR)[1];
    }
    return id;
  }

  /**
   * FIXME：由于前端对于 id 的拼接逻辑，需要通过 terminalsMap 是否存在对应 terminal 实例来获取真实 id
   */
  getRealTerminalId(id: string) {
    let terminalId = '';
    const shortId = this.getTerminalShortId(id);
    if (this.terminalsMap.has(id)) {
      terminalId = id;
    } else if (this.terminalsMap.has(shortId)) {
      terminalId = shortId;
    }
    return terminalId;
  }

  $onDidChangeActiveTerminal(id: string) {
    const terminal = this.getTerminal(id);
    const original = this.activeTerminal;
    // 当激活的终端为 Task 终端时，同样需要将 activeTerminal 置为 undefined
    this.activeTerminal = terminal;
    if (original !== this.activeTerminal) {
      this.changeActiveTerminalEvent.fire(this.activeTerminal);
    }
  }

  get onDidChangeActiveTerminal(): Event<Terminal | undefined> {
    return this.changeActiveTerminalEvent.event;
  }

  $onDidCloseTerminal(e: ITerminalExitEvent) {
    const terminalId = this.getRealTerminalId(e.id);
    const terminal = this.terminalsMap.get(terminalId);
    if (!terminal) {
      // 说明此时收到的可能为 Task 终端关闭事件，直接忽略即可
      return;
    }

    terminal.setExitCode(e.code);
    this.closeTerminalEvent.fire(terminal);

    this.terminalsMap.delete(terminalId);
  }

  get onDidCloseTerminal(): Event<Terminal> {
    return this.closeTerminalEvent.event;
  }

  $onDidOpenTerminal(info: ITerminalInfo) {
    let terminal = this.getTerminal(info.id);
    if (!terminal) {
      terminal = new Terminal(info.name, info, this.proxy, info.id);
      this.terminalsMap.set(info.id, terminal);
      const deferred = this._terminalDeferreds.get(info.id);
      deferred?.resolve(terminal);
    }
    this.openTerminalEvent.fire(terminal);
  }

  $onDidTerminalTitleChange(id: string, name: string) {
    const terminal = this.getTerminal(id);
    if (terminal) {
      if (name !== terminal.name) {
        terminal.setName(name);
      }
    }
  }

  get onDidOpenTerminal(): Event<Terminal> {
    return this.openTerminalEvent.event;
  }

  get shellPath() {
    return this._defaultProfile?.path || process.env.SHELL || userInfo().shell!;
  }

  get onDidChangeTerminalState(): Event<Terminal> {
    return this.terminalStateChangeEvent.event;
  }

  createTerminal(name?: string, shellPath?: string, shellArgs?: string[] | string): vscode.Terminal {
    const shortId = uuid();
    const terminal = new Terminal(name || '', { name, shellPath, shellArgs }, this.proxy);
    terminal.create(
      {
        name,
        shellPath,
        shellArgs,
      },
      shortId,
    );
    this.terminalsMap.set(shortId, terminal);
    return terminal;
  }

  createTerminalFromOptions(options: vscode.TerminalOptions) {
    // 插件 API 同步提供 terminal 实例
    const shortId = uuid();
    const terminal = new Terminal(options.name, options, this.proxy);
    terminal.create(options, shortId);
    this.terminalsMap.set(shortId, terminal);
    return terminal;
  }

  createExtensionTerminal(options: vscode.ExtensionTerminalOptions) {
    const shortId = uuid();
    const terminal = new Terminal(options.name, options, this.proxy);
    const p = new ExtHostPseudoterminal(options.pty);
    terminal.createExtensionTerminal(shortId);
    this.terminalsMap.set(shortId, terminal);
    const disposable = this._setupExtHostProcessListeners(shortId, p);
    this._terminalProcessDisposables[shortId] = disposable;

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
      if (this.getTerminal(info.id)) {
        return;
      }
      const terminal = new Terminal(info.name, info, this.proxy, info.id);
      if (info.isActive) {
        this.activeTerminal = terminal;
      }
      // 终端恢复时，id 为前端创建，故不需要处理 id 信息
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

  async $provideLinks(id: string, line: string): Promise<ITerminalLinkDto[]> {
    const terminalId = this.getRealTerminalId(id);

    const terminal = this.getTerminal(terminalId);
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

  $activateLink(id: string, linkId: number): void {
    const terminalId = this.getRealTerminalId(id);
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
  /**
   * @deprecated this function is useless, will removed in 2.17.0
   */
  $acceptDefaultShell(shellPath: string) {
    // will remove
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
    let terminal = this.getTerminal(id);
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
    disposables.add(
      p.onProcessTitleChanged((title) => {
        this.proxy.$sendProcessTitle(id, title);
        this._getTerminalByIdEventually(id).then((terminal) => {
          if (terminal) {
            terminal.setName(title);
          }
        });
      }),
    );

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
    const terminal = this.getTerminal(terminalId);
    if (terminal) {
      terminal.setName(name);
    }
  }

  public $acceptTerminalInteraction(terminalId: string) {
    const terminal = this.getTerminal(terminalId);
    if (terminal?.setInteractedWith()) {
      this.terminalStateChangeEvent.fire(terminal);
    }
  }

  getEnvironmentVariableCollection(extension: IExtension, rootUri: string = NO_ROOT_URI) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this;
    let collection = this.environmentVariableCollections.get([extension.id, rootUri]);
    if (!collection) {
      collection = new (class extends EnvironmentVariableCollection {
        override getScoped(scope: vscode.EnvironmentVariableScope): vscode.EnvironmentVariableCollection {
          return that.getEnvironmentVariableCollection(extension, scope.workspaceFolder?.uri.toString());
        }
      })();

      this._setEnvironmentVariableCollection(extension.id, rootUri, collection);
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
    rootUri: string,
    collection: EnvironmentVariableCollection,
  ): void {
    this.environmentVariableCollections.set([extensionIdentifier, rootUri], collection);
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
export class EnvironmentVariableCollection implements vscode.GlobalEnvironmentVariableCollection {
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getScoped(_scope: vscode.EnvironmentVariableScope): vscode.EnvironmentVariableCollection {
    throw new Error('Cannot get scoped from a regular env var collection');
  }

  private _setIfDiffers(variable: string, mutator: vscode.EnvironmentVariableMutator): void {
    const current = this.map.get(variable);
    if (!current || current.value !== mutator.value || current.type !== mutator.type) {
      this.map.set(variable, mutator);
      this._onDidChangeCollection.fire();
    }
  }

  replace(variable: string, value: string, options?: vscode.EnvironmentVariableMutatorOptions): void {
    this._setIfDiffers(variable, {
      value,
      type: EnvironmentVariableMutatorType.Replace,
      options: options ?? { applyAtProcessCreation: true },
    });
  }

  append(variable: string, value: string, options?: vscode.EnvironmentVariableMutatorOptions): void {
    this._setIfDiffers(variable, {
      value,
      type: EnvironmentVariableMutatorType.Append,
      options: options ?? { applyAtProcessCreation: true },
    });
  }

  prepend(variable: string, value: string, options?: vscode.EnvironmentVariableMutatorOptions): void {
    this._setIfDiffers(variable, {
      value,
      type: EnvironmentVariableMutatorType.Prepend,
      options: options ?? { applyAtProcessCreation: true },
    });
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
  private _state: vscode.TerminalState = { isInteractedWith: false };

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

  get state(): vscode.TerminalState {
    return this._state;
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

  /**
   * 所有插件进程的终端调用都需要指定 id
   * 该逻辑用于保障依赖 `vscode.window.onDidOpenTerminal` 获取 terminal 实例的相关逻辑
   * 让相关 terminal 的值引用一致
   * 如 vscode-js-debug 中的 https://github.com/microsoft/vscode-js-debug/blob/a201e735c94b9aeb1e13d8c586b91a1fe1ab62b3/src/ui/debugTerminalUI.ts#L198
   */
  async create(options: vscode.TerminalOptions, shortId: string): Promise<void> {
    await this.proxy.$createTerminal(options, shortId);
    this.created(shortId);
  }

  created(shortId: string) {
    this.id = shortId;
    this.__id = shortId;

    this.createdPromiseResolve();
  }

  dispose(): void {
    this.proxy.$dispose(this.id);
  }

  async createExtensionTerminal(id: string): Promise<void> {
    await this.proxy.$createTerminal({ name: this.name, isExtensionTerminal: true }, id);
    this.created(id);
  }

  public setExitCode(code: number | undefined) {
    this._exitStatus = Object.freeze({ code });
  }

  public setName(name: string) {
    this._name = name;
  }

  public setInteractedWith() {
    if (!this._state.isInteractedWith) {
      (this._state as any).isInteractedWith = true;
      return true;
    }
    return false;
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
