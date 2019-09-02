import { LogLevel as KTLogLevel, Emitter } from '@ali/ide-core-common';
import * as vscode from 'vscode';
import { LogLevel } from './ext-types';

export interface IMainThreadEnv {
  $clipboardReadText(): Thenable<string>;
  $clipboardWriteText(value: string): Thenable<void>;

  $openExternal(target: vscode.Uri): Thenable<boolean>;
}

export interface IExtHostEnv {
  $setEnvValues(values: ExtHostEnvValues);
  $fireChangeLogLevel(value: KTLogLevel);
  $setLogLevel(value: KTLogLevel);
  logLevel: LogLevel;

  setEnvValues(values: ExtHostEnvValues);
  getEnvValues(): ExtHostEnvValues;

  logLevelChangeEmitter: Emitter<LogLevel>;
}

export interface ExtHostEnvValues {
  appName?: string;
  appRoot?: string;
  uriScheme?: string;
  language?: string;
  machineId?: string;
  sessionId?: string;
  remoteName?: string;
  logLevel?: LogLevel;
}
