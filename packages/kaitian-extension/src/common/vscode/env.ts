import { LogLevel as KTLogLevel, Emitter } from '@ali/ide-core-common';
import type * as vscode from 'vscode';
import { LogLevel, UIKind } from './ext-types';

export interface IMainThreadEnv {
  $clipboardReadText(): Thenable<string>;
  $clipboardWriteText(value: string): Thenable<void>;

  $openExternal(target: vscode.Uri): Promise<boolean>;
}

export interface IExtHostEnv {
  $setEnvValues(values: Partial<ExtHostEnvValues>);
  $fireChangeLogLevel(value: KTLogLevel);
  $setLogLevel(value: KTLogLevel);
  logLevel: LogLevel;

  setEnvValues(values: ExtHostEnvValues);
  getEnvValues(): ExtHostEnvValues;

  logLevelChangeEmitter: Emitter<LogLevel>;
}

export interface ExtHostEnvValues {
  appName: string;
  uriScheme: string;
  language: string;
  uiKind: UIKind;
}
