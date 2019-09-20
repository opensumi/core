import { Injectable } from '@ali/common-di';
import { RPCService } from '@ali/ide-connection';
import { PtyService, IPty } from './pty';
import { ITerminalService, TerminalOptions, ITerminalServiceClient } from '../common';

@Injectable()
export class TerminalServiceImpl extends RPCService implements ITerminalService {
  private terminalMap: Map<string, IPty> = new Map();
  private ptyService = new PtyService();

  private serviceClientMap: Map<string, ITerminalServiceClient> = new Map();

  public setClient(clientId: string, client: ITerminalServiceClient) {
    this.serviceClientMap.set(clientId, client);
  }
  // TODO: 销毁流程
  public disposeClient() {

  }
  public create(id: string, rows: number, cols: number, options: TerminalOptions) {

    const terminal = this.ptyService.create(rows, cols, options);
    terminal.on('data', (data) => {
      const clientId = id.split('|')[0];
      if (this.serviceClientMap.has(clientId)) {
        const serviceClient = this.serviceClientMap.get(clientId) as ITerminalServiceClient;
        serviceClient.clientMessage(id, data);
      }

      // 兼容直接使用的模式
      if (this.rpcClient) {
        this.rpcClient[0].onMessage(id, data);
      }
    });
    this.terminalMap.set(id , terminal);
    return {
      pid: terminal.pid,
      process: terminal.process,
    };
  }

  public onMessage(id, msg) {
    const terminal = this.getTerminal(id);
    if (!terminal) {
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

  getShellName(id: string): string | undefined {
    const terminal = this.getTerminal(id);

    if (!terminal) {
      return ;
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
    this.terminalMap.forEach((term) => {
      term.kill();
    });
  }

  private getTerminal(id: string) {
    return this.terminalMap.get(id);
  }
}
