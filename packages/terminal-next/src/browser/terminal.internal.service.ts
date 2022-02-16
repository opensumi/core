import { Terminal as XTermTerminal } from 'xterm';
import { Injectable, Autowired } from '@opensumi/di';
import {
  generateSessionId,
  ITerminalService,
  ITerminalInternalService,
  ITerminalError,
  IPtyExitEvent,
  ITerminalController,
  TerminalOptions,
  ITerminalProfile,
  IShellLaunchConfig,
  ITerminalConnection,
} from '../common';
import { TerminalProcessExtHostProxy } from './terminal.ext.host.proxy';
import { OperatingSystem } from '@opensumi/ide-core-common/lib/platform';

@Injectable()
export class TerminalInternalService implements ITerminalInternalService {
  @Autowired(ITerminalService)
  protected readonly service: ITerminalService;

  @Autowired(ITerminalController)
  protected readonly controller: ITerminalController;

  private _processExtHostProxies = new Map<string, TerminalProcessExtHostProxy>();

  generateSessionId() {
    return this.service.generateSessionId ? this.service.generateSessionId() : generateSessionId();
  }

  getOptions() {
    return this.service.getOptions ? this.service.getOptions() : {};
  }

  check(sessionIds: string[]) {
    return this.service.check ? this.service.check(sessionIds) : Promise.resolve(true);
  }

  private _getExtHostProxy(id: string) {
    return this._processExtHostProxies.get(id);
  }

  async attach(
    sessionId: string,
    xterm: XTermTerminal,
    rows: number,
    cols: number,
    options: TerminalOptions = {},
    type: string,
  ) {
    if (options.isExtensionTerminal) {
      const proxy = new TerminalProcessExtHostProxy(sessionId, cols, rows, this.controller);
      proxy.start();
      proxy.onProcessExit(() => {
        this._processExtHostProxies.delete(sessionId);
      });
      this._processExtHostProxies.set(sessionId, proxy);
      return {
        name: options.name || 'ExtensionTerminal-' + sessionId,
        readonly: false,
        onData: proxy.onProcessData.bind(proxy),
        sendData: proxy.input.bind(proxy),
        onExit: proxy.onProcessExit.bind(proxy),
      };
    }
    return this.service.attach(sessionId, xterm, rows, cols, options, type);
  }

  async sendText(sessionId: string, message: string) {
    const proxy = this._getExtHostProxy(sessionId);
    if (proxy) {
      return proxy.emitData(message);
    }
    return this.service.sendText(sessionId, message);
  }

  async resize(sessionId: string, cols: number, rows: number) {
    const proxy = this._getExtHostProxy(sessionId);
    if (proxy) {
      return proxy.resize(cols, rows);
    }
    return this.service.resize(sessionId, cols, rows);
  }

  disposeById(sessionId: string) {
    const proxy = this._getExtHostProxy(sessionId);
    if (proxy) {
      this._processExtHostProxies.delete(sessionId);
      return proxy.dispose();
    }
    return this.service.disposeById(sessionId);
  }

  async getProcessId(sessionId: string) {
    const proxy = this._getExtHostProxy(sessionId);
    if (proxy) {
      return -1;
    }
    return this.service.getProcessId(sessionId);
  }

  onError(handler: (error: ITerminalError) => void) {
    return this.service.onError(handler);
  }

  onExit(handler: (event: IPtyExitEvent) => void) {
    return this.service.onExit(handler);
  }

  async getOs(): Promise<OperatingSystem> {
    return await this.service.getOs();
  }
  async getProfiles(autoDetect: boolean): Promise<ITerminalProfile[]> {
    return await this.service.getProfiles(autoDetect);
  }
  async getDefaultSystemShell(): Promise<string> {
    return await this.service.getDefaultSystemShell();
  }
  async getCodePlatformKey(): Promise<'osx' | 'windows' | 'linux'> {
    return await this.service.getCodePlatformKey();
  }
  async attachByLaunchConfig(
    sessionId: string,
    cols: number,
    rows: number,
    launchConfig: IShellLaunchConfig,
  ): Promise<ITerminalConnection | undefined> {
    return await this.service.attachByLaunchConfig(sessionId, cols, rows, launchConfig);
  }
}
