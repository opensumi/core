import { Autowired } from '@opensumi/di';
import { AppConfig, ClientAppContribution, Disposable } from '@opensumi/ide-core-browser';
import { DevtoolsLantencyCommand, EDevtoolsEvent } from '@opensumi/ide-core-common/lib/devtools';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';

import { ConnectionRTTBrowserService, ConnectionRTTBrowserServiceToken } from './connection-rtt-service';

@Domain(ClientAppContribution)
export class ChromeDevtoolsContribution extends Disposable implements ClientAppContribution {
  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(ConnectionRTTBrowserServiceToken)
  protected readonly rttService: ConnectionRTTBrowserService;

  private interval?: NodeJS.Timeout;

  static INTERVAL = 1000;

  protected lantencyHandler = (event: CustomEvent) => {
    const { command } = event.detail;
    if (command === DevtoolsLantencyCommand.Start) {
      if (!this.interval) {
        this.startRTTInterval();
      }
    } else if (command === DevtoolsLantencyCommand.Stop) {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = undefined;
      }
    }
  };

  initialize() {
    // only runs when devtools supoprt is enabled
    if (this.appConfig.devtools) {
      // receive notification from opensumi devtools by custom event
      window.addEventListener(EDevtoolsEvent.Latency, this.lantencyHandler);

      this.addDispose(
        Disposable.create(() => {
          window.removeEventListener(EDevtoolsEvent.Latency, this.lantencyHandler);
          if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
          }
        }),
      );

      // if opensumi devtools has started capturing before this contribution point is registered
      if (window.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__?.captureRPC) {
        if (!this.interval) {
          this.startRTTInterval();
        }
      }
    }
  }

  private startRTTInterval() {
    this.interval = setInterval(async () => {
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
