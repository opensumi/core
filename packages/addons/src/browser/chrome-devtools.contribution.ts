import { Autowired } from '@opensumi/di';
import { ClientAppContribution } from '@opensumi/ide-core-browser';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';

import { ConnectionRTTBrowserServiceToken, ConnectionRTTBrowserService } from './connection-rtt-service';

@Domain(ClientAppContribution)
export class ChromeDevtoolsContribution implements ClientAppContribution {
  @Autowired(ConnectionRTTBrowserServiceToken)
  protected readonly rttService: ConnectionRTTBrowserService;

  private interval?: NodeJS.Timeout;

  static INTERVAL = 1000;

  // start and keep polling for the states of opensumi devtools
  initialize() {
    global.setInterval(() => {
      // if devtools is in capturing state, rtt should be measured and
      // will be presented as network latency in opensumi devtools
      if (window.__opensumi_devtools && window.__opensumi_devtools.capture) {
        if (!this.interval) {
          this.startRTTInterval();
        }
      } else {
        if (this.interval) {
          global.clearInterval(this.interval);
          this.interval = undefined;
        }
      }
    }, 1000);
  }

  private startRTTInterval() {
    this.interval = global.setInterval(async () => {
      const start = Date.now();
      await this.rttService.measure();
      const rtt = Date.now() - start;
      // "if" below is to prevent setting latency after stoping capturing
      if (window.__opensumi_devtools.capture) {
        window.__opensumi_devtools.latency = rtt;
      }
    }, ChromeDevtoolsContribution.INTERVAL);
  }
}
