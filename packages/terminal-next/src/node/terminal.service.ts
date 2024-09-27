import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { AppConfig, INodeLogger, Sequencer, isDevelopment, isElectronNode, pSeries } from '@opensumi/ide-core-node';
import { getChunks } from '@opensumi/ide-utils/lib/strings';

import { ETerminalErrorType, ITerminalNodeService, ITerminalServiceClient, TERMINAL_ID_SEPARATOR } from '../common';
import { IPtyProcessProxy, IPtyService, IShellLaunchConfig } from '../common/pty';

import { PtyService } from './pty';
import { IPtyServiceManager, PtyServiceManagerToken } from './pty.manager';

// ref: https://github.com/vercel/hyper/blob/4c90d7555c79fb6dc438fa9549f1d0ef7c7a5aa7/app/session.ts#L27-L32
// 批处理字符最大长度 (200KB)
const BATCH_MAX_SIZE = 200 * 1024;
// 批处理延时
const BATCH_DURATION_MS = 16;

/**
 * 每个通知前端的数据包最大的大小 (20MB)
 */
const BATCH_CHUNK_MAX_SIZE = 20 * 1024 * 1024;

@Injectable()
export class TerminalServiceImpl implements ITerminalNodeService {
  static TerminalPtyCloseThreshold = 10 * 1000;

  private terminalProcessMap: Map<string, IPtyService> = new Map();
  private clientTerminalMap: Map<string, Map<string, PtyService>> = new Map();

  private serviceClientMap: Map<string, ITerminalServiceClient> = new Map();
  private closeTimeOutMap: Map<string, NodeJS.Timeout> = new Map();

  private batchedPtyDataMap: Map<string, string> = new Map();
  private batchedPtyDataTimer: Map<string, NodeJS.Timeout> = new Map();

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(INodeLogger)
  private logger: INodeLogger;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(PtyServiceManagerToken)
  private readonly ptyServiceManager: IPtyServiceManager;

  public setClient(clientId: string, client: ITerminalServiceClient) {
    if (clientId.indexOf(TERMINAL_ID_SEPARATOR) >= 0) {
      clientId = clientId.split(TERMINAL_ID_SEPARATOR)[0];
    }
    this.serviceClientMap.set(clientId, client);
    // 如果有相同的setClient clientId被调用，则取消延时触发closeClient，否则会导致终端无响应
    const timeOutHandler = this.closeTimeOutMap.get(clientId);
    if (timeOutHandler) {
      clearTimeout(timeOutHandler);
      this.closeTimeOutMap.delete(clientId);
    }
  }

  // 检查SessionId是否存活，但是因为之前接口设计有问题只返回了boolean，所以不能批量返回SessionId的检查结果
  // 可以通过多次调用来达成目的，每次调用terminalIdArr只传入一个东西
  public async ensureClientTerminal(clientId: string, terminalIdArr: string[]) {
    const sessionIdArray = terminalIdArr.map((id) => id.split(TERMINAL_ID_SEPARATOR)[1]);
    const sessionCheckResArray = await Promise.all(
      sessionIdArray.map((sessionId) => this.ptyServiceManager.checkSession(sessionId)),
    );
    this.logger.log(`Ensure terminal client ${clientId} ${terminalIdArr} ${sessionCheckResArray}`);

    // 有一个存活就true，所以为了准确使用，每次调用terminalIdArr只传入一个东西
    for (const sessionCheckRes of sessionCheckResArray) {
      if (sessionCheckRes) {
        return true;
      }
    }
    return false;
  }

  public closeClient(clientId: string) {
    // 延时触发，因为WS本身有重连逻辑，因此通过延时触发来避免断开后不就重连但是回调方法都被dispose的问题
    const closeTimer = setTimeout(
      () => {
        this.disposeClient(clientId);
        this.logger.debug(`Remove pty process from ${clientId} client`);
      },
      isDevelopment() ? 0 : this.appConfig.terminalPtyCloseThreshold || TerminalServiceImpl.TerminalPtyCloseThreshold,
    );
    this.closeTimeOutMap.set(clientId, closeTimer);
  }

  public disposeClient(clientId: string) {
    const terminalMap = this.clientTerminalMap.get(clientId);
    // 如果是Electron也要直接kill掉，跟随IDE Server的生命周期
    const isElectronNodeEnv = isElectronNode();

    if (terminalMap) {
      terminalMap.forEach((t, id) => {
        this.terminalProcessMap.delete(id);

        if (
          t.shellLaunchConfig.disablePersistence ||
          t.shellLaunchConfig.isExtensionOwnedTerminal ||
          isElectronNodeEnv
        ) {
          t.kill(); // shellLaunchConfig 有 isTransient 的参数时，要Kill，不保活
        }
        // t.kill(); // 这个是窗口关闭时候触发，终端默认在这种场景下保活, 不kill
        // TODO: 后续看看有没有更加优雅的方案
      });
      this.clientTerminalMap.delete(clientId);
    }
  }

  private flushPtyData(clientId: string, sessionId: string) {
    if (!this.batchedPtyDataMap.has(sessionId)) {
      return;
    }

    const ptyData = this.batchedPtyDataMap.get(sessionId)!;
    this.batchedPtyDataMap.delete(sessionId);

    if (this.batchedPtyDataTimer.has(sessionId)) {
      clearTimeout(this.batchedPtyDataTimer.get(sessionId)!);
      this.batchedPtyDataTimer.delete(sessionId);
    }

    const serviceClient = this.serviceClientMap.get(clientId) as ITerminalServiceClient;

    const chunks = getChunks(ptyData, BATCH_CHUNK_MAX_SIZE);
    pSeries(chunks.map((str) => () => serviceClient.clientMessage(sessionId, str)));
  }

  public async create2(
    sessionId: string,
    cols: number,
    rows: number,
    launchConfig: IShellLaunchConfig,
  ): Promise<IPtyProcessProxy | undefined> {
    const clientId = sessionId.split(TERMINAL_ID_SEPARATOR)[0];
    let ptyService: PtyService | undefined;

    try {
      ptyService = this.injector.get(PtyService, [sessionId, launchConfig, cols, rows]);
      this.terminalProcessMap.set(sessionId, ptyService);

      // ref: https://hyper.is/blog
      // 合并 pty 输出的数据，16ms 后发送给客户端，如
      // 果在 16ms 内没有收到新的数据，或短时间内数据
      // 超过 BATCH_MAX_SIZE 限定的长度，则立即发送缓
      // 存的数据，避免因为输出较多时阻塞 RPC 通信
      ptyService.onData((chunk: string) => {
        if (this.serviceClientMap.has(clientId)) {
          const ptyData = this.batchedPtyDataMap.get(sessionId) || '';

          this.batchedPtyDataMap.set(sessionId, ptyData + chunk);

          if (ptyData.length + chunk.length >= BATCH_MAX_SIZE) {
            this.flushPtyData(clientId, sessionId);
          }

          if (!this.batchedPtyDataTimer.has(sessionId)) {
            this.batchedPtyDataTimer.set(
              sessionId,
              setTimeout(() => this.flushPtyData(clientId, sessionId), BATCH_DURATION_MS),
            );
          }
        } else {
          this.logger.warn(`terminal: pty ${clientId} on data not found`);
        }
      });

      ptyService.onExit(({ exitCode, signal }) => {
        this.logger.debug(`Terminal process ${sessionId} exit with code ${exitCode}`);
        if (this.serviceClientMap.has(clientId)) {
          this.flushPtyData(clientId, sessionId);
          const serviceClient = this.serviceClientMap.get(clientId) as ITerminalServiceClient;
          serviceClient.closeClient(sessionId, {
            code: exitCode,
            signal,
          });
        } else {
          this.logger.warn(`The pty process ${clientId} not found`);
        }
      });

      ptyService.onProcessChange((processName) => {
        this.logger.debug(`Terminal process change (${processName})`);
        if (this.serviceClientMap.has(clientId)) {
          const serviceClient = this.serviceClientMap.get(clientId) as ITerminalServiceClient;
          serviceClient.processChange(sessionId, processName);
        } else {
          this.logger.warn(`The pty process ${clientId} not found`);
        }
      });

      const error = await ptyService.start();
      if (error) {
        this.logger.error(`Terminal process ${sessionId} start error\n`, error);
        throw error;
      }

      if (!this.clientTerminalMap.has(clientId)) {
        this.clientTerminalMap.set(clientId, new Map());
      }
      this.clientTerminalMap.get(clientId)?.set(sessionId, ptyService);
    } catch (error) {
      this.logger.error(
        `${sessionId} create terminal error: ${JSON.stringify(error)}, options: ${JSON.stringify(launchConfig)}`,
      );
      if (this.serviceClientMap.has(clientId)) {
        const serviceClient = this.serviceClientMap.get(clientId) as ITerminalServiceClient;
        serviceClient.closeClient(sessionId, {
          id: sessionId,
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
      this.logger.warn(`The terminal ${id} not found`);
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
    // TODO 后续需要一个合理的 Dispose 逻辑，暂时不要 Dispose，避免重连时终端不可用
    // this.serviceClientMap.forEach((client) => {
    //   client.dispose();
    // });
  }

  private getTerminal(id: string) {
    return this.terminalProcessMap.get(id);
  }

  async getCwd(id: string): Promise<string | undefined> {
    const ptyService = this.getTerminal(id);
    if (!ptyService) {
      return undefined;
    }

    return await ptyService.getCwd();
  }
}
