import { Injectable, Autowired } from '@ali/common-di';
import { ITerminalService, ITerminalServiceClient, TerminalOptions } from '../common';
import { RPCService } from '@ali/ide-connection';

@Injectable()
export class TerminalServiceClientImpl extends RPCService implements ITerminalServiceClient {

  @Autowired(ITerminalService, { multiple: true })
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
    return this.terminalService.create(id, rows, cols, options);
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
    this.terminalService.dispose();
  }
}
