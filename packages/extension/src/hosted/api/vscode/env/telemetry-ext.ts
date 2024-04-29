import { Emitter, Event } from '@opensumi/ide-core-common';

import type { TelemetryLoggerOptions, TelemetrySender, TelemetryTrustedValue } from 'vscode';

export class TelemetryExtImpl {
  _isTelemetryEnabled: boolean = false; // telemetry not activated by default
  private readonly onDidChangeTelemetryEnabledEmitter = new Emitter<boolean>();
  readonly onDidChangeTelemetryEnabled: Event<boolean> = this.onDidChangeTelemetryEnabledEmitter.event;

  get isTelemetryEnabled(): boolean {
    return this._isTelemetryEnabled;
  }

  set isTelemetryEnabled(isTelemetryEnabled: boolean) {
    if (this._isTelemetryEnabled !== isTelemetryEnabled) {
      this._isTelemetryEnabled = isTelemetryEnabled;
      this.onDidChangeTelemetryEnabledEmitter.fire(this._isTelemetryEnabled);
    }
  }

  createTelemetryLogger(sender: TelemetrySender, options?: TelemetryLoggerOptions | undefined): TelemetryLogger {
    const logger = new TelemetryLogger(sender, this._isTelemetryEnabled, options);
    this.onDidChangeTelemetryEnabled((isEnabled) => {
      logger.telemetryEnabled = isEnabled;
    });
    return logger;
  }
}

export class TelemetryLogger {
  private sender: TelemetrySender | undefined;
  readonly options: TelemetryLoggerOptions | undefined;
  readonly commonProperties: Record<string, any>;
  telemetryEnabled: boolean;

  private readonly onDidChangeEnableStatesEmitter: Emitter<TelemetryLogger> = new Emitter();
  readonly onDidChangeEnableStates: Event<TelemetryLogger> = this.onDidChangeEnableStatesEmitter.event;
  private _isUsageEnabled: boolean;
  private _isErrorsEnabled: boolean;

  constructor(sender: TelemetrySender, telemetryEnabled: boolean, options?: TelemetryLoggerOptions) {
    this.sender = sender;
    this.options = options;
    this.commonProperties = this.getCommonProperties();
    this._isErrorsEnabled = true;
    this._isUsageEnabled = true;
    this.telemetryEnabled = telemetryEnabled;
  }

  get isUsageEnabled(): boolean {
    return this._isUsageEnabled;
  }

  set isUsageEnabled(isUsageEnabled: boolean) {
    if (this._isUsageEnabled !== isUsageEnabled) {
      this._isUsageEnabled = isUsageEnabled;
      this.onDidChangeEnableStatesEmitter.fire(this);
    }
  }

  get isErrorsEnabled(): boolean {
    return this._isErrorsEnabled;
  }

  set isErrorsEnabled(isErrorsEnabled: boolean) {
    if (this._isErrorsEnabled !== isErrorsEnabled) {
      this._isErrorsEnabled = isErrorsEnabled;
      this.onDidChangeEnableStatesEmitter.fire(this);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logUsage(eventName: string, data?: Record<string, any | TelemetryTrustedValue<any>>): void {
    // TODO
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logError(eventNameOrException: string | Error, data?: Record<string, any | TelemetryTrustedValue<any>>): void {
    // TODO
  }

  dispose(): void {
    // TODO
  }

  private logEvent(eventName: string, data?: Record<string, any>): void {
    // TODO
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getCommonProperties(): Record<string, any> {
    return [];
  }
}
