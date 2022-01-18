import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { PtyService } from './pty';
import { IPty } from '../common/pty';
import { IShellLaunchConfig } from '../common/pty';
import { ITerminalNodeService, ITerminalServiceClient } from '../common';
import { INodeLogger, AppConfig, isDevelopment } from '@opensumi/ide-core-node';

/**
 * terminal service 的具体实现
 * @lengthmin: 其实这里应该换成每个实例持有一个 pty 实例，待讨论并推进实现
 */
@Injectable()
export class TerminalServiceImpl implements ITerminalNodeService {
  static TerminalPtyCloseThreshold = 10 * 1000;

  private terminalProcessMap: Map<string, PtyService> = new Map();
  private clientTerminalMap: Map<string, Map<string, PtyService>> = new Map();
  private clientTerminalThresholdMap: Map<string, NodeJS.Timeout> = new Map();

  private serviceClientMap: Map<string, ITerminalServiceClient> = new Map();

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(INodeLogger)
  private logger: INodeLogger;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  public setClient(clientId: string, client: ITerminalServiceClient) {
    this.serviceClientMap.set(clientId, client);
  }

  public ensureClientTerminal(clientId: string, terminalIdArr: string[]) {
    if (this.clientTerminalThresholdMap.has(clientId)) {
      clearTimeout(this.clientTerminalThresholdMap.get(clientId) as NodeJS.Timeout);
      this.logger.debug(`重连 clientId ${clientId} 窗口的 pty 进程`);
    }

    return this.clientTerminalMap.has(clientId);
  }

  public closeClient(clientId: string) {
    const closeTimer = global.setTimeout(
      () => {
        this.disposeClient(clientId);
        this.logger.debug(`删除 clientId ${clientId} 窗口的 pty 进程`);
        this.clientTerminalThresholdMap.delete(clientId);
      },
      isDevelopment() ? 0 : this.appConfig.terminalPtyCloseThreshold || TerminalServiceImpl.TerminalPtyCloseThreshold,
    );

    this.clientTerminalThresholdMap.set(clientId, closeTimer);
  }

  public disposeClient(clientId: string) {
    const terminalMap = this.clientTerminalMap.get(clientId);

    if (terminalMap) {
      terminalMap.forEach((t, id) => {
        this.terminalProcessMap.delete(id);
        t.kill();
      });
      this.clientTerminalMap.delete(clientId);
    }
  }

  public async create2(id: string, cols: number, rows: number, options: IShellLaunchConfig) {
    const clientId = id.split('|')[0];
    let terminal: PtyService | undefined;

    try {
      terminal = this.injector.get(PtyService, [id, options, cols, rows]);
      this.terminalProcessMap.set(id, terminal);

      terminal.onData((data) => {
        if (this.serviceClientMap.has(clientId)) {
          const serviceClient = this.serviceClientMap.get(clientId) as ITerminalServiceClient;
          serviceClient.clientMessage(id, data);
        } else {
          this.logger.warn(`terminal: pty ${clientId} on data not found`);
        }
      });

      terminal.onExit(({ exitCode, signal }) => {
        this.logger.debug(`Terminal process exit (instanceId: ${id}) with code ${exitCode}`);
        if (this.serviceClientMap.has(clientId)) {
          const serviceClient = this.serviceClientMap.get(clientId) as ITerminalServiceClient;
          serviceClient.closeClient(id, {
            code: exitCode,
            signal,
          });
        } else {
          this.logger.warn(`terminal: pty ${clientId} on data not found`);
        }
      });

      const error = await terminal.start();
      if (error) {
        this.logger.error(`Terminal process start error (instanceId: ${id})`, error);
        throw error;
      }

      if (!this.clientTerminalMap.has(clientId)) {
        this.clientTerminalMap.set(clientId, new Map());
      }
      this.clientTerminalMap.get(clientId)!.set(id, terminal);
    } catch (error) {
      this.logger.error(`${id} create terminal error: ${error}, options: ${JSON.stringify(options)}`);
      if (this.serviceClientMap.has(clientId)) {
        const serviceClient = this.serviceClientMap.get(clientId) as ITerminalServiceClient;
        serviceClient.closeClient(id, {
          id,
          code: error?.code,
          message: error?.message,
          stopped: true,
        });
      }
    }

    return terminal?.pty;
  }

  public onMessage(id: string, msg: string) {
    const terminal = this.getTerminal(id);
    if (!terminal) {
      this.logger.warn(`terminal ${id} onMessage not found`, terminal);
      return;
    }
    terminal.onMessage(msg);
  }

  public resize(id: string, rows: number, cols: number) {
    const terminal = this.getTerminal(id);

    if (!terminal) {
      return;
    }
    terminal.resize(rows, cols);
  }

  getShellName(id: string): string {
    const terminal = this.getTerminal(id);
    if (!terminal) {
      return 'invalid terminal';
    }
    return terminal.getShellName();
  }

  getProcessId(id: string): number {
    const terminal = this.getTerminal(id);
    if (!terminal) {
      return -1;
    }
    return terminal.getPid();
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
    return this.terminalProcessMap.get(id);
  }
}
