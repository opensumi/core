import { Injectable } from '@ali/common-di';
import {RPCService} from '@ali/ide-connection';
import {PtyService} from './pty';

@Injectable()
export class TerminalService extends RPCService {
  private terminal;
  private ptyService = new PtyService();

  public init(rows, cols, cwd) {

    console.log('terminal2 init', rows, cols, cwd);
    const terminal = this.terminal = this.ptyService.create(rows, cols, cwd);

    terminal.on('data', (data) => {
      console.log('terminal2 pty data', data);
      if (this.rpcClient) {
        this.rpcClient[0].onMessage(data);
      }
    });
  }

  public onMessage(msg) {
    if (this.terminal) {
      this.terminal.write(msg);
    }
  }
  public resize() {

  }

}
