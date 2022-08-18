import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import { Emitter, LogLevel as KTLogLevel, Schemes, URI } from '@opensumi/ide-core-common';

import { MainThreadAPIIdentifier, IMainThreadEnv, IExtHostEnv, ExtHostEnvValues } from '../../../../common/vscode';
import { LogLevel } from '../../../../common/vscode/ext-types';

export class ExtHostEnv implements IExtHostEnv {
  private rpcProtocol: IRPCProtocol;
  private values: ExtHostEnvValues;
  protected readonly proxy: IMainThreadEnv;

  readonly logLevelChangeEmitter = new Emitter<LogLevel>();
  logLevel: LogLevel;

  constructor(rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadEnv);
  }

  $setEnvValues(values: ExtHostEnvValues) {
    return this.setEnvValues(values);
  }

  setEnvValues(values: ExtHostEnvValues) {
    this.values = Object.assign({}, this.values, values);
  }

  getEnvValues() {
    return this.values;
  }

  async asExternalUri(target: vscode.Uri): Promise<vscode.Uri> {
    if (!target.scheme.trim().length) {
      throw new Error('Invalid scheme - cannot be empty');
    }
    if (![Schemes.http, Schemes.https, this.values.uriScheme].includes(target.scheme)) {
      throw new Error(`Invalid scheme '${target.scheme}'`);
    }
    const uri = await this.proxy.$asExternalUri(target);
    return URI.revive(uri);
  }

  $fireChangeLogLevel(logLevel) {
    this.$setLogLevel(logLevel);
    this.logLevelChangeEmitter.fire(this.logLevel);
  }

  $setLogLevel(level: KTLogLevel) {
    this.logLevel = this.toVSCodeLogLevel(level);
  }

  private toVSCodeLogLevel(level: KTLogLevel): LogLevel {
    if (level === KTLogLevel.Verbose) {
      return LogLevel.Trace;
    }
    if (level === KTLogLevel.Debug) {
      return LogLevel.Debug;
    }
    if (level === KTLogLevel.Info) {
      return LogLevel.Info;
    }
    if (level === KTLogLevel.Warning) {
      return LogLevel.Warning;
    }
    if (level === KTLogLevel.Error) {
      return LogLevel.Error;
    }
    if (level === KTLogLevel.Critical) {
      return LogLevel.Critical;
    }
    if (level === KTLogLevel.Off) {
      return LogLevel.Off;
    }
    return LogLevel.Info;
  }
}
