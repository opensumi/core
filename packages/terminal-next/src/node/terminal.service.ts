import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { INodeLogger, AppConfig, isDevelopment } from '@opensumi/ide-core-node';

import { ETerminalErrorType, ITerminalNodeService, ITerminalServiceClient } from '../common';
import { IPtyProcess, IShellLaunchConfig } from '../common/pty';

import { PtyService } from './pty';


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

  private flushPtyData(clientId: string, sessionId: string) {
    const ptyData = this.batchedPtyDataMap.get(sessionId)!;
    this.batchedPtyDataMap.delete(sessionId);
    this.batchedPtyDataTimer.delete(sessionId);

    const serviceClient = this.serviceClientMap.get(clientId) as ITerminalServiceClient;
    serviceClient.clientMessage(sessionId, ptyData);
  }

  public async create2(id: string, cols: IShellLaunchConfig): Promise<IPtyProcess | undefined>;
  public async create2(
    id: string,
    cols: number,
    rows: number,
    options: IShellLaunchConfig,
  ): Promise<IPtyProcess | undefined>;
  public async create2(
    id: string,
    _cols: unknown,
    _rows?: unknown,
    _launchConfig?: unknown,
  ): Promise<IPtyProcess | undefined> {
    const clientId = id.split('|')[0];
    let ptyService: PtyService | undefined;
    let cols = _cols as number;
    let rows = _rows as number;
    let launchConfig = _launchConfig as IShellLaunchConfig;
    if (!(typeof cols === 'number')) {
      launchConfig = cols as IShellLaunchConfig;
      cols = (launchConfig as any).cols;
      rows = (launchConfig as any).rows;
      if ((launchConfig as any).shellPath) {
        launchConfig.executable = (launchConfig as any).shellPath;
      }
    }

    try {
      ptyService = this.injector.get(PtyService, [id, launchConfig, cols, rows]);
      this.terminalProcessMap.set(id, ptyService);

      // ref: https://hyper.is/blog
      // 合并 pty 输出的数据，16ms 后发送给客户端，如
      // 果在 16ms 内没有收到新的数据，或短时间内数据
      // 超过 BATCH_MAX_SIZE 限定的长度，则立即发送缓
      // 存的数据，避免因为输出较多时阻塞 RPC 通信
      ptyService.onData((chunk: string) => {
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

      ptyService.onExit(({ exitCode, signal }) => {
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

      const error = await ptyService.start();
      if (error) {
        this.logger.error(`Terminal process start error (instanceId: ${id})`, error);
        throw error;
      }

      if (!this.clientTerminalMap.has(clientId)) {
        this.clientTerminalMap.set(clientId, new Map());
      }
      this.clientTerminalMap.get(clientId)?.set(id, ptyService);
    } catch (error) {
      this.logger.error(
        `${id} create terminal error: ${JSON.stringify(error)}, options: ${JSON.stringify(launchConfig)}`,
      );
      if (this.serviceClientMap.has(clientId)) {
        const serviceClient = this.serviceClientMap.get(clientId) as ITerminalServiceClient;
        serviceClient.closeClient(id, {
          id,
          message: error?.message,
          type: ETerminalErrorType.CREATE_FAIL,
          stopped: true,
          launchConfig,
        });
      }
    }

    return ptyService?.pty;
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
