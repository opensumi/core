import { Injectable, Autowired } from '@opensumi/di';
import { PtyService, IPtyService } from './pty';
import { IPty } from '../common/pty';
import { IShellLaunchConfig } from '../common/pty';
import { ITerminalNodeService, ITerminalServiceClient } from '../common';
import { INodeLogger, AppConfig, isDevelopment } from '@opensumi/ide-core-node';

// ref: https://github.com/vercel/hyper/blob/4c90d7555c79fb6dc438fa9549f1d0ef7c7a5aa7/app/session.ts#L27-L32
// 批处理字符最大长度
const BATCH_MAX_SIZE = 200 * 1024;
// 批处理延时
const BATCH_DURATION_MS = 16;

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

  private batchedPtyDataMap: Map<string, string> = new Map();
  private batchedPtyDataTimer: Map<string, NodeJS.Timeout> = new Map();

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

  private flushPtyData(clientId: string, sessionId: string) {
    const ptyData = this.batchedPtyDataMap.get(sessionId);
    this.batchedPtyDataMap.delete(sessionId);
    this.batchedPtyDataTimer.delete(sessionId);

    const serviceClient = this.serviceClientMap.get(clientId) as ITerminalServiceClient;
    serviceClient.clientMessage(sessionId, ptyData);
  }

  public async create2(id: string, options: IShellLaunchConfig) {
    const clientId = id.split('|')[0];
    let terminal: IPty | undefined;

    try {
      terminal = (await this.ptyService.create2(options)) as IPty;
      this.terminalMap.set(id, terminal);

      // ref: https://hyper.is/blog
      // 合并 pty 输出的数据，16ms 后发送给客户端，如
      // 果在 16ms 内没有收到新的数据，或短时间内数据
      // 超过 BATCH_MAX_SIZE 限定的长度，则立即发送缓
      // 存的数据，避免因为输出较多时阻塞 RPC 通信
      terminal.onData((chunk: string) => {
        if (this.serviceClientMap.has(clientId)) {
          if (!this.batchedPtyDataMap.has(id)) {
            this.batchedPtyDataMap.set(id, '');
          }

          this.batchedPtyDataMap.set(id, this.batchedPtyDataMap.get(id) + chunk);

          const ptyData = this.batchedPtyDataMap.get(id) || '';

          if (ptyData?.length + chunk.length >= BATCH_MAX_SIZE) {
            if (this.batchedPtyDataTimer.has(id)) {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              global.clearTimeout(this.batchedPtyDataTimer.get(id)!);
              this.batchedPtyDataTimer.delete(id);
            }
            this.flushPtyData(clientId, id);
          }

          if (!this.batchedPtyDataTimer.has(id)) {
            this.batchedPtyDataTimer.set(
              id,
              global.setTimeout(() => this.flushPtyData(clientId, id), BATCH_DURATION_MS),
            );
          }
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
      this.clientTerminalMap.get(clientId)?.set(id, terminal);
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
