import { Injectable, Autowired } from '@ide-framework/common-di';
import { PtyService, IPty } from './pty';
import { ITerminalNodeService, TerminalOptions, ITerminalServiceClient } from '../common';
import { INodeLogger, AppConfig, isDevelopment } from '@ide-framework/ide-core-node';

/**
 * terminal service 的具体实现
 */
@Injectable()
export class TerminalServiceImpl implements ITerminalNodeService {

  static TerminalPtyCloseThreshold = 10 * 1000;

  private terminalMap: Map<string, IPty> = new Map();
  private clientTerminalMap: Map<string, Map<string, IPty>> = new Map();
  private clientTerminalThresholdMap: Map<string, NodeJS.Timeout> = new Map();
  private ptyService = new PtyService();

  private serviceClientMap: Map<string, ITerminalServiceClient> = new Map();

  @Autowired(INodeLogger)
  private logger: INodeLogger;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  public setClient(clientId: string, client: ITerminalServiceClient) {
    this.serviceClientMap.set(clientId, client);
  }

  public ensureClientTerminal(clientId: string, terminalIdArr: string[]) {
    if (this.clientTerminalThresholdMap.has(clientId)) {
      clearTimeout(this.clientTerminalThresholdMap.get(clientId) as NodeJS.Timeout );
      this.logger.debug(`重连 clientId ${clientId} 窗口的 pty 进程`);
    }

    return this.clientTerminalMap.has(clientId);
  }

  public closeClient(clientId: string) {
    const closeTimer = global.setTimeout(() => {
      this.disposeClient(clientId);
      this.logger.debug(`删除 clientId ${clientId} 窗口的 pty 进程`);
      this.clientTerminalThresholdMap.delete(clientId );
    }, isDevelopment() ? 0 : (this.appConfig.terminalPtyCloseThreshold || TerminalServiceImpl.TerminalPtyCloseThreshold));

    this.clientTerminalThresholdMap.set(clientId, closeTimer);
  }

  public disposeClient(clientId: string) {
    const terminalMap = this.clientTerminalMap.get(clientId);

    if (terminalMap) {
      terminalMap.forEach((pty, id) => {
        this.terminalMap.delete(id);
        pty.kill();
      });
      this.clientTerminalMap.delete(clientId);
    }
  }

  public async create(id: string, rows: number, cols: number, options: TerminalOptions) {
    const clientId = id.split('|')[0];
    const terminal = await this.ptyService.create(rows, cols, options);

    this.terminalMap.set(id , terminal);

    terminal.on('data', (data) => {
      if (this.serviceClientMap.has(clientId)) {
        const serviceClient = this.serviceClientMap.get(clientId) as ITerminalServiceClient;
        serviceClient.clientMessage(id, data);
      } else {
        this.logger.warn(`terminal: pty ${clientId} on data not found`);
      }
    });

    terminal.on('exit', (exitCode: number, signal: number | undefined) => {
      if (this.serviceClientMap.has(clientId)) {
        const serviceClient = this.serviceClientMap.get(clientId) as ITerminalServiceClient;
        serviceClient.closeClient(id, exitCode, signal);
      } else {
        this.logger.warn(`terminal: pty ${clientId} on data not found`);
      }
    });

    const clientMap = this.clientTerminalMap.get(clientId);

    if (!clientMap) {
      this.clientTerminalMap.set(clientId, new Map());
    }
    (this.clientTerminalMap.get(clientId) as Map<string, IPty>).set(id, terminal);

    return terminal;
  }

  public onMessage(id, msg) {
    const terminal = this.getTerminal(id);
    if (!terminal) {
      this.logger.warn(`terminal ${id} onMessage not found`, terminal);
      return;
    }
    terminal.write(msg);
  }

  public resize(id, rows, cols) {
    const terminal = this.getTerminal(id);

    if (!terminal) {
      return;
    }
    this.ptyService.resize(terminal, rows, cols);
  }

  getShellName(id: string): string {
    const terminal = this.getTerminal(id);
    if (!terminal) {
      return '';
    }
    const match = terminal.bin.match(/[\w|.]+$/);
    return match ? match[0] : 'sh';
  }

  getProcessId(id: string): number {
    const terminal = this.getTerminal(id);

    if (!terminal) {
      return -1;
    }
    return terminal.pid;
  }

  disposeById(id: string) {
    const terminal = this.getTerminal(id);

    if (!terminal) {
      return;
    }
    terminal.kill();
  }

  dispose() {
    this.serviceClientMap.forEach((client) => {
      client.dispose();
    });
  }

  private getTerminal(id: string) {
    return this.terminalMap.get(id);
  }
}
