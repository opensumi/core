import { Autowired, Injectable, Optional } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { Disposable, IDisposable, ILogger, PreferenceService } from '@opensumi/ide-core-browser';
import {
  IStartExtensionTerminalRequest,
  ITerminalApiService,
  ITerminalClient,
  ITerminalController,
  ITerminalDimensions,
  ITerminalDimensionsDto,
  ITerminalExternalLinkProvider,
  ITerminalGroupViewService,
  ITerminalInfo,
  ITerminalLink,
  ITerminalProcessExtHostProxy,
  ITerminalProfileInternalService,
} from '@opensumi/ide-terminal-next';
import {
  EnvironmentVariableServiceToken,
  IEnvironmentVariableService,
  SerializableEnvironmentVariableCollection,
  deserializeEnvironmentVariableCollection,
} from '@opensumi/ide-terminal-next/lib/common/environmentVariable';
import { ITerminalProfileService } from '@opensumi/ide-terminal-next/lib/common/profile';

import { ExtHostAPIIdentifier, IExtHostTerminal, IMainThreadTerminal } from '../../../common/vscode';
import { IActivationEventService } from '../../types';

import type vscode from 'vscode';

@Injectable({ multiple: true })
export class MainThreadTerminal implements IMainThreadTerminal {
  private readonly proxy: IExtHostTerminal;

  shortId2LongIdMap: Map<string, string> = new Map();

  private readonly _terminalProcessProxies = new Map<string, ITerminalProcessExtHostProxy>();
  private readonly _profileProviders = new Map<string, IDisposable>();

  /**
   * A single shared terminal link provider for the exthost. When an ext registers a link
   * provider, this is registered with the terminal on the renderer side and all links are
   * provided through this, even from multiple ext link providers. Xterm should remove lower
   * priority intersecting links itself.
   */
  private _linkProvider: IDisposable | undefined;

  @Autowired(EnvironmentVariableServiceToken)
  private environmentVariableService: IEnvironmentVariableService;

  @Autowired(ITerminalApiService)
  private terminalApi: ITerminalApiService;

  @Autowired(ITerminalController)
  private controller: ITerminalController;

  @Autowired(ITerminalProfileService)
  private profileService: ITerminalProfileService;

  @Autowired(ITerminalProfileInternalService)
  private profileInternalSerivce: ITerminalProfileInternalService;

  @Autowired(ITerminalGroupViewService)
  private terminalGroupViewService: ITerminalGroupViewService;

  @Autowired(PreferenceService)
  protected readonly preference: PreferenceService;

  @Autowired(IActivationEventService)
  protected readonly activationEventService: IActivationEventService;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  private disposable = new Disposable();

  constructor(@Optional(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostTerminal);
    this.initData();
    this.bindEvent();
  }

  public dispose() {
    this.disposable.dispose();
  }

  private bindEvent() {
    this.disposable.addDispose(
      this.terminalApi.onDidChangeActiveTerminal((id) => {
        this.proxy.$onDidChangeActiveTerminal(id);
      }),
    );
    this.disposable.addDispose(
      this.terminalApi.onDidCloseTerminal((e) => {
        this.proxy.$onDidCloseTerminal(e);
      }),
    );
    this.disposable.addDispose(
      this.terminalApi.onDidTerminalTitleChange((e) => {
        this.proxy.$onDidTerminalTitleChange(e.id, e.name);
      }),
    );
    this.disposable.addDispose(
      this.terminalApi.onDidOpenTerminal((info: ITerminalInfo) => {
        const client = this.controller.clients.get(info.id);
        if (client) {
          client.addDispose(
            (client as any).xterm.raw.onData(() => {
              this.proxy.$acceptTerminalInteraction(info.id);
            }),
          );
        }
        this.proxy.$onDidOpenTerminal(info);
      }),
    );
    this.disposable.addDispose(
      this.controller.onInstanceRequestStartExtensionTerminal((e) => this._onRequestStartExtensionTerminal(e)),
    );
    this.disposable.addDispose(
      this.profileService.onDidChangeAvailableProfiles(() => {
        this._updateDefaultProfile();
      }),
    );
    this.disposable.addDispose(
      this.profileService.onTerminalProfileResolved(async (id: string) => {
        await this.activationEventService.fireEvent(`onTerminalProfile:${id}`);
      }),
    );
    this.disposable.addDispose(
      this.profileService.onDidChangeDefaultShell((shell: string) => {
        this.proxy.$setShell(shell);
      }),
    );
  }

  private initData() {
    const terminals = this.terminalApi.terminals;
    const infoList: ITerminalInfo[] = [];

    terminals.forEach((term) => {
      infoList.push({
        id: term.id,
        name: term.name,
        isActive: term.isActive,
      });
    });

    this.proxy.$setTerminals(infoList);

    this._updateDefaultProfile();
  }

  transform<T>(id: string, cb: (sessionId: string) => T): T {
    const sessionId = this.shortId2LongIdMap.get(id);
    return cb(sessionId || id);
  }

  $sendText(id: string, text: string, addNewLine?: boolean) {
    return this.transform(id, (sessionId) => {
      this.proxy.$acceptTerminalInteraction(sessionId);
      return this.terminalApi.sendText(sessionId, text, addNewLine);
    });
  }

  $show(id: string, preserveFocus?: boolean) {
    return this.transform(id, (sessionId) => this.terminalApi.showTerm(sessionId, preserveFocus));
  }

  $hide(id: string) {
    return this.transform(id, (sessionId) => this.terminalApi.hideTerm(sessionId));
  }

  $dispose(id: string) {
    return this.transform(id, (sessionId) => this.terminalApi.removeTerm(sessionId));
  }

  $getProcessId(id: string) {
    return this.transform(id, (sessionId) => this.terminalApi.getProcessId(sessionId));
  }

  async $createTerminal(options: vscode.TerminalOptions, shortId: string): Promise<void> {
    await this.controller.ready.promise;
    const terminal = await this.terminalApi.createTerminal(options, shortId);
    if (!terminal) {
      // 应该要 throw Error
      this.logger.error(`Create Terminal ${shortId} fail.`);
      return;
    }
    this.shortId2LongIdMap.set(shortId, terminal.id);
  }

  private _onRequestStartExtensionTerminal(request: IStartExtensionTerminalRequest): void {
    const proxy = request.proxy;
    this._terminalProcessProxies.set(proxy.terminalId, proxy);

    // Note that onResize is not being listened to here as it needs to fire when max dimensions
    // change, excluding the dimension override
    const initialDimensions: ITerminalDimensionsDto | undefined =
      request.cols && request.rows
        ? {
            columns: request.cols,
            rows: request.rows,
          }
        : undefined;

    this.proxy.$startExtensionTerminal(proxy.terminalId, initialDimensions).then(request.callback);

    proxy.onInput((data) => this.proxy.$acceptProcessInput(proxy.terminalId, data));
    proxy.onShutdown((immediate) => this.proxy.$acceptProcessShutdown(proxy.terminalId, immediate));
    proxy.onRequestCwd(() => this.proxy.$acceptProcessRequestCwd(proxy.terminalId));
    proxy.onRequestInitialCwd(() => this.proxy.$acceptProcessRequestInitialCwd(proxy.terminalId));
  }

  private _getTerminalProcess(id: string): ITerminalProcessExtHostProxy {
    return this.transform(id, (terminalId) => {
      const terminal = this._terminalProcessProxies.get(terminalId);
      if (!terminal) {
        throw new Error(`Unknown terminal: ${terminalId}`);
      }
      return terminal;
    });
  }

  public $sendProcessTitle(id: string, title: string): void {
    return this.transform(id, (terminalId) => {
      const terminalWidgetInstance = this.terminalGroupViewService.getWidget(terminalId);

      if (terminalWidgetInstance) {
        terminalWidgetInstance.rename(title);

        this.proxy.$acceptTerminalTitleChange(terminalId, title);
      }
    });
  }

  public $sendProcessData(terminalId: string, data: string): void {
    this._getTerminalProcess(terminalId).emitData(data);
  }

  public $sendProcessReady(terminalId: string, pid: number, cwd: string): void {
    this._getTerminalProcess(terminalId).emitReady(pid, cwd);
  }

  public $sendProcessExit(terminalId: string, exitCode: number | undefined): void {
    this._getTerminalProcess(terminalId).emitExit(exitCode);
    this._terminalProcessProxies.delete(terminalId);
  }

  public $sendOverrideDimensions(terminalId: string, dimensions: ITerminalDimensions | undefined): void {
    this._getTerminalProcess(terminalId).emitOverrideDimensions(dimensions);
  }

  public $sendProcessInitialCwd(terminalId: string, initialCwd: string): void {
    this._getTerminalProcess(terminalId).emitInitialCwd(initialCwd);
  }

  public $sendProcessCwd(terminalId: string, cwd: string): void {
    this._getTerminalProcess(terminalId).emitCwd(cwd);
  }

  public $startLinkProvider() {
    this._linkProvider?.dispose();
    this._linkProvider = this.controller.registerLinkProvider(new ExtensionTerminalLinkProvider(this.proxy));
  }

  public $stopLinkProvider() {
    this._linkProvider?.dispose();
    this._linkProvider = undefined;
  }

  public $registerProfileProvider(id: string, extensionIdentifier: string): void {
    // Proxy profile provider requests through the extension host
    this._profileProviders.set(
      id,
      this.profileService.registerTerminalProfileProvider(extensionIdentifier, id, {
        createContributedTerminalProfile: async (options) => {
          this.proxy.$createContributedProfileTerminal(id, options);
        },
      }),
    );
  }

  public $unregisterProfileProvider(id: string): void {
    this._profileProviders.get(id)?.dispose();
    this._profileProviders.delete(id);
  }

  private async _updateDefaultProfile() {
    const defaultProfile = await this.profileInternalSerivce.resolveDefaultProfile();
    if (defaultProfile) {
      this.proxy.$acceptDefaultProfile(defaultProfile);
    }
  }

  $setEnvironmentVariableCollection(
    extensionIdentifier: string,
    persistent: boolean,
    collection: SerializableEnvironmentVariableCollection | undefined,
  ): void {
    if (collection) {
      const translatedCollection = {
        persistent,
        map: deserializeEnvironmentVariableCollection(collection),
      };
      this.environmentVariableService.set(extensionIdentifier, translatedCollection);
    } else {
      this.environmentVariableService.delete(extensionIdentifier);
    }
  }
}

class ExtensionTerminalLinkProvider implements ITerminalExternalLinkProvider {
  constructor(private readonly _proxy: IExtHostTerminal) {}

  async provideLinks(instance: ITerminalClient, line: string): Promise<ITerminalLink[] | undefined> {
    const proxy = this._proxy;
    const extHostLinks = await proxy.$provideLinks(instance.id, line);
    return extHostLinks.map((dto) => ({
      id: dto.id,
      startIndex: dto.startIndex,
      length: dto.length,
      label: dto.label,
      activate: () => proxy.$activateLink(instance.id, dto.id),
    }));
  }
}
