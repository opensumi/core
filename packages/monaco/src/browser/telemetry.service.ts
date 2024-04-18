import { Injectable } from '@opensumi/di';
import { Emitter } from '@opensumi/ide-core-common';
import {
  ITelemetryService,
  TelemetryLevel,
} from '@opensumi/monaco-editor-core/esm/vs/platform/telemetry/common/telemetry';

@Injectable()
export class MonacoTelemetryService implements ITelemetryService {
  declare readonly _serviceBrand: undefined;
  readonly telemetryLevel = TelemetryLevel.NONE;
  readonly machineId = 'placeholder';
  readonly sqmId = 'placeholder';
  readonly firstSessionDate = 'placeholder';
  readonly sendErrorTelemetry = false;

  private _sessionId = 'placeholder';

  private eventLogEmitter = new Emitter<{
    type: 'renameInvokedEvent';
    event: any;
  }>();

  onEventLog = this.eventLogEmitter.event;

  get sessionId(): string {
    return this._sessionId;
  }

  setEnabled(): void {}
  setExperimentProperty(): void {}
  publicLog() {}
  publicLog2(type: string, event: any) {
    switch (type) {
      case 'renameInvokedEvent':
        this.eventLogEmitter.fire({ type, event });
        break;
      default:
      // ignore
    }
  }
  publicLogError() {}
  publicLogError2() {}
}
