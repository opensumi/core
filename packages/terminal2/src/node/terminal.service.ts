import { Injectable } from '@ali/common-di';
import { RPCService } from '@ali/ide-connection';
import { PtyService, pty } from './pty';
import { ITerminalService } from '../common';

@Injectable()
export class TerminalServiceImpl extends RPCService implements ITerminalService {
  private terminalMap: Map<string, pty.IPty> = new Map();
  private ptyService = new PtyService();

  public create(id: string, rows: number, cols: number, cwd: string) {
    const terminal = this.ptyService.create(rows, cols, cwd);

    terminal.on('data', (data) => {
      if (this.rpcClient) {
        this.rpcClient[0].onMessage(id, data);
      }
    });
    this.terminalMap.set(id , terminal);
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

  private getTerminal(id: string) {
    return this.terminalMap.get(id);
  }

  dispose() {
    // TODO
  }
}
