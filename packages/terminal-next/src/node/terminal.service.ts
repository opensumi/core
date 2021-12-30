import { Injectable, Autowired } from '@opensumi/di';
import { PtyService, IPtyService } from './pty';
import { IPty, TerminalOptions } from '../common/pty';
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

  private terminalMap: Map<string, IPty> = new Map();
  private clientTerminalMap: Map<string, Map<string, IPty>> = new Map();
  private clientTerminalThresholdMap: Map<string, NodeJS.Timeout> = new Map();

  @Autowired(IPtyService)
  private ptyService: PtyService;

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
      clearTimeout(this.clientTerminalThresholdMap.get(clientId) as NodeJS.Timeout);
      this.logger.debug(`重连 clientId ${clientId} 窗口的 pty 进程`);
    }

    return this.clientTerminalMap.has(clientId);
  }

  public closeClient(clientId: string) {
    // TODO: 实现关闭客户端，调用客户端的 closeClient 方法
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
      terminalMap.forEach((pty, id) => {
        this.terminalMap.delete(id);
        pty.kill();
      });
      this.clientTerminalMap.delete(clientId);
    }
  }

  /**
   * 内部已经不会调用这个方法了，只会调用 create2
   * @deprecated Will remove in the next major version
   * @param id
   * @param rows
   * @param cols
   * @param options
   * @returns
   */
  public async create(id: string, rows: number, cols: number, options: TerminalOptions) {
    const clientId = id.split('|')[0];
    const terminal = await this.ptyService.create(rows, cols, options);

    this.terminalMap.set(id, terminal);

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

  public async create2(id: string, options: IShellLaunchConfig) {
    const clientId = id.split('|')[0];
    let terminal: IPty | undefined;

    try {
      terminal = (await this.ptyService.create2(options)) as IPty;
      this.terminalMap.set(id, terminal);

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
          message: error.message,
          stopped: true,
        });
      }
    }

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
      return 'invalid terminal';
    }
    return terminal.parsedName;
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
