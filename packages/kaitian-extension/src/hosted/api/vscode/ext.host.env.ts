import * as vscode from 'vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { createHash } from 'crypto';
import { v4 } from 'uuid';
import * as address from 'address';
import { MainThreadAPIIdentifier, IMainThreadEnv } from '../../../common/vscode';
import {
  // IExtensionProcessService,
  IExtHostEnv,
  ExtHostEnvValues,
} from '../../../common/vscode';
import { IExtensionHostService } from '../../../common';
import { LogLevel } from '../../../common/vscode/ext-types';
import { Event, Emitter, LogLevel as KTLogLevel } from '@ali/ide-core-common';

export class Env {
  private macMachineId: string;
  public sessionId: string;

  constructor() {
    address.mac((err, macAddress) => {
      if (!err) {
        this.macMachineId = createHash('sha256').update(macAddress, 'utf8').digest('hex');
      } else {
        this.macMachineId = v4();
      }
    });

    this.sessionId = v4();
  }

  get machineId(): string {
    return this.macMachineId;
  }
}

const envValue = new Env();

export function createEnvApiFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionHostService,
  envHost: IExtHostEnv,
): vscode.env {
  const proxy: IMainThreadEnv = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadEnv);
  const values: ExtHostEnvValues = envHost.getEnvValues();
  const env = {
    appName: values.appName,
    uriScheme: values.uriScheme,
    language: values.language,
    sessionId: values.sessionId || envValue.sessionId,
    machineId: values.machineId || envValue.machineId,
    appRoot: 'appRoot',
    remoteName: 'remoteName',
    clipboard: {
      readText(): Thenable<string> {
        return proxy.$clipboardReadText();
      },
      writeText(value: string): Thenable<void> {
        return proxy.$clipboardWriteText(value);
      },
    },
    openExternal(target: vscode.Uri): Thenable<boolean> {
      return proxy.$openExternal(target);
    },
    // todo: implements
    get logLevel() {
      // checkProposedApiEnabled(extension);
      return envHost.logLevel;
    },
    get onDidChangeLogLevel(): Event<LogLevel> {
      // checkProposedApiEnabled(extension);
      return envHost.logLevelChangeEmitter.event;
    },
  };

  return Object.freeze(env);
}

export class ExtHostEnv implements IExtHostEnv {
  private rpcProtocol: IRPCProtocol;
  private values: ExtHostEnvValues = {};
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
