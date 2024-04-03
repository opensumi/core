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
  readonly machineId = 'someValue.machineId';
  readonly sqmId = 'someValue.sqmId';
  readonly firstSessionDate = 'someValue.firstSessionDate';
  readonly sendErrorTelemetry = false;

  private _sessionId = 'initial';

  private eventLogEmitter = new Emitter<{
    type: 'renameInvokedEvent' | string;
    event: any;
  }>();

  onEventLog = this.eventLogEmitter.event;

  setSessionId(sessionId: string): void {
    this._sessionId = sessionId;
  }

  setReporter() {
    // ignore
  }

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
