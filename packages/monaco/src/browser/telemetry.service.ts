import { Injectable } from '@opensumi/di';
import { Dispatcher } from '@opensumi/ide-core-common';
import {
  ITelemetryService,
  TelemetryLevel,
} from '@opensumi/monaco-editor-core/esm/vs/platform/telemetry/common/telemetry';

@Injectable()
export class MonacoTelemetryService implements ITelemetryService {
  devDeviceId: string;
  msftInternal?: boolean | undefined;

  declare readonly _serviceBrand: undefined;
  readonly telemetryLevel = TelemetryLevel.NONE;
  readonly machineId = 'placeholder';
  readonly sqmId = 'placeholder';
  readonly firstSessionDate = 'placeholder';
  readonly sendErrorTelemetry = false;

  private _sessionId = 'placeholder';

  private eventLogEmitter = new Dispatcher<any>();

  onEventLog(type: 'renameInvokedEvent', listener: (e: any) => any) {
    return this.eventLogEmitter.on(type)(listener);
  }

  get sessionId(): string {
    return this._sessionId;
  }

  setEnabled(): void { }
  setExperimentProperty(): void { }
  publicLog() { }
  publicLog2(type: string, event: any) {
    switch (type) {
      case 'renameInvokedEvent':
        this.eventLogEmitter.dispatch(type, event);
        break;
      default:
      // ignore
    }
  }
  publicLogError() { }
  publicLogError2() { }
}
