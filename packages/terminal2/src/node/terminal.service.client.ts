import { Injectable, Autowired } from '@ali/common-di';
import { RPCService } from '@ali/ide-connection';
import { ITerminalService, ITerminalServiceClient, TerminalOptions } from '../common';
import { IPty } from './pty';

/**
 * 标准的后端服务，供前端调用
 * 目前每个窗口会对应一个 TerminalServiceClientImpl 实例
 */
@Injectable()
export class TerminalServiceClientImpl extends RPCService implements ITerminalServiceClient {
  private terminalMap: Map<string, IPty> = new Map();

  @Autowired(ITerminalService)
  private terminalService: ITerminalService;
  private clientId: string;

  setConnectionClientId(clientId: string) {
    this.clientId = clientId;

    this.terminalService.setClient(this.clientId, this);
  }

  clientMessage(id, data) {
    if (this.rpcClient) {
      this.rpcClient[0].onMessage(id, data);
    }
  }

  create(id: string, rows: number, cols: number, options: TerminalOptions ) {
    const pty = this.terminalService.create(id, rows, cols, options) as IPty;
    this.terminalMap.set(id, pty);
    return {
      pid: pty.pid,
      name: this.terminalService.getShellName(id) || '',
    };
  }

  onMessage(id: string, msg: string): void {
    this.terminalService.onMessage(id, msg);
  }

  resize(id: string, rows: number, cols: number) {
    this.terminalService.resize(id, rows, cols);
  }

  disposeById(id: string) {
    this.terminalService.disposeById(id);
  }

  getProcessId(id: string): number {
    return this.terminalService.getProcessId(id);
  }

  dispose() {
    this.terminalMap.forEach((pty) => {
      pty.kill();
    });
  }
}
