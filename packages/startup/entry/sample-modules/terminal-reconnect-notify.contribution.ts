import { Autowired, Injectable } from '@opensumi/di';
import { ClientAppContribution, Domain, ILogger } from '@opensumi/ide-core-browser';
import { DisposableCollection } from '@opensumi/ide-core-common';
import { ITerminalService } from '@opensumi/ide-terminal-next';

/**
 * Example: listen for terminal reconnect events and surface a warning toast to users.
 * This is optional and only wired in the startup sample module to demonstrate usage.
 */
@Injectable()
@Domain(ClientAppContribution)
export class TerminalReconnectNotifyContribution implements ClientAppContribution {
  private readonly toDispose = new DisposableCollection();

  @Autowired(ITerminalService)
  private readonly terminalService: ITerminalService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  onDidStart() {
    const disconnectDisposable = this.terminalService.onDisconnect?.((sessionId) => {
      this.logger.log(`Terminal disconnected: ${sessionId}`);
    });
    if (disconnectDisposable) {
      this.toDispose.push(disconnectDisposable);
    }

    const reconnectDisposable = this.terminalService.onReconnected?.((sessionId: string) => {
      this.logger.log(`Terminal reconnected: ${sessionId}`);
    });
    if (reconnectDisposable) {
      this.toDispose.push(reconnectDisposable);
    }
  }

  dispose() {
    this.toDispose.dispose();
  }
}
