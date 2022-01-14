import type vscode from 'vscode';
import { Injectable, Optional, Autowired } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { ILogger, Disposable, PreferenceService, IDisposable } from '@opensumi/ide-core-browser';
import {
  ITerminalApiService,
  ITerminalGroupViewService,
  ITerminalController,
  ITerminalInfo,
  ITerminalProcessExtHostProxy,
  IStartExtensionTerminalRequest,
  ITerminalDimensions,
  ITerminalDimensionsDto,
  ITerminalExternalLinkProvider,
  ITerminalClient,
  ITerminalLink,
} from '@opensumi/ide-terminal-next';
import {
  IEnvironmentVariableService,
  SerializableEnvironmentVariableCollection,
  EnvironmentVariableServiceToken,
} from '@opensumi/ide-terminal-next/lib/common/environmentVariable';
import { deserializeEnvironmentVariableCollection } from '@opensumi/ide-terminal-next/lib/common/environmentVariable';
import { IMainThreadTerminal, IExtHostTerminal, ExtHostAPIIdentifier } from '../../../common/vscode';
import { ITerminalProfileService } from '@opensumi/ide-terminal-next/lib/common/profile';

@Injectable({ multiple: true })
export class MainThreadTerminal implements IMainThreadTerminal {
  private readonly proxy: IExtHostTerminal;
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
  private profileSerivce: ITerminalProfileService;

  @Autowired(ITerminalGroupViewService)
  private terminalGroupViewService: ITerminalGroupViewService;

  @Autowired(PreferenceService)
  protected readonly preference: PreferenceService;

  private disposable = new Disposable();

  @Autowired(ILogger)
  logger: ILogger;

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
      this.terminalApi.onDidOpenTerminal((info: ITerminalInfo) => {
        this.proxy.$onDidOpenTerminal(info);
      }),
    );
    this.disposable.addDispose(
      this.controller.onInstanceRequestStartExtensionTerminal((e) => this._onRequestStartExtensionTerminal(e)),
    );
    this.disposable.addDispose(
      this.profileSerivce.onDidChangeAvailableProfiles(() => {
        this._updateDefaultProfile();
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

  $sendText(id: string, text: string, addNewLine?: boolean) {
    return this.terminalApi.sendText(id, text, addNewLine);
  }

  $show(id: string, preserveFocus?: boolean) {
    return this.terminalApi.showTerm(id, preserveFocus);
  }

  $hide(id: string) {
    return this.terminalApi.hideTerm(id);
  }

  $dispose(id: string) {
    return this.terminalApi.removeTerm(id);
  }

  $getProcessId(id: string) {
    return this.terminalApi.getProcessId(id);
  }

  async $createTerminal(options: vscode.TerminalOptions) {
    await this.controller.ready.promise;
    const terminal = await this.terminalApi.createTerminal(options);
    if (!terminal) {
      return this.logger.error('创建终端失败');
    }
    return terminal.id;
  }

  private _onRequestStartExtensionTerminal(request: IStartExtensionTerminalRequest): void {
    const proxy = request.proxy;
    this._terminalProcessProxies.set(proxy.terminalId, proxy);

    // Note that onReisze is not being listened to here as it needs to fire when max dimensions
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

  private _getTerminalProcess(terminalId: string): ITerminalProcessExtHostProxy {
    const terminal = this._terminalProcessProxies.get(terminalId);
    if (!terminal) {
      throw new Error(`Unknown terminal: ${terminalId}`);
    }
    return terminal;
  }

  public $sendProcessTitle(terminalId: string, title: string): void {
    const terminalWidgetInstance = this.terminalGroupViewService.getWidget(terminalId);

    if (terminalWidgetInstance) {
      terminalWidgetInstance.rename(title);

      this.proxy.$acceptTerminalTitleChange(terminalId, title);
    }
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
      this.profileSerivce.registerTerminalProfileProvider(extensionIdentifier, id, {
        createContributedTerminalProfile: async (options) => this.proxy.$createContributedProfileTerminal(id, options),
      }),
    );
  }

  public $unregisterProfileProvider(id: string): void {
    this._profileProviders.get(id)?.dispose();
    this._profileProviders.delete(id);
  }

  private async _updateDefaultProfile() {
    const defaultProfile = await this.profileSerivce.resolveDefaultProfile({});
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
