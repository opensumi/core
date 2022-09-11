import { Autowired } from '@opensumi/di';
import { ClientAppContribution } from '@opensumi/ide-core-browser';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';

import { ConnectionRTTBrowserServiceToken, ConnectionRTTBrowserService } from './connection-rtt-service';

enum DevtoolsEvent {
  Latency = 'devtools:latency',
}

enum DevtoolsCommand {
  Start = 'start',
  Stop = 'stop',
}

@Domain(ClientAppContribution)
export class ChromeDevtoolsContribution implements ClientAppContribution {
  @Autowired(ConnectionRTTBrowserServiceToken)
  protected readonly rttService: ConnectionRTTBrowserService;

  private interval?: NodeJS.Timeout;

  static INTERVAL = 1000;

  initialize() {
    // receive notification from opensumi devtools by custom event
    window.addEventListener(DevtoolsEvent.Latency, (event) => {
      const { command } = event.detail;
      if (command === DevtoolsCommand.Start) {
        if (!this.interval) {
          this.startRTTInterval();
        }
      } else if (command === DevtoolsCommand.Stop) {
        if (this.interval) {
          global.clearInterval(this.interval);
          this.interval = undefined;
        }
      }
    });

    // if opensumi devtools has started capturing before this contribution point is registered
    if (window.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__?.captureRPC) {
      if (!this.interval) {
        this.startRTTInterval();
      }
    }
  }

  private startRTTInterval() {
    this.interval = global.setInterval(async () => {
      const start = Date.now();
      await this.rttService.measure();
      const rtt = Date.now() - start;
      // "if" below is to prevent setting latency after stoping capturing
      if (window.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__.captureRPC) {
        window.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__.latency = rtt;
      }
    }, ChromeDevtoolsContribution.INTERVAL);
  }
}
