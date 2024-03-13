import { Emitter, LogLevel as KTLogLevel } from '@opensumi/ide-core-common';

import { LogLevel, UIKind, UriComponents } from './ext-types';

import type vscode from 'vscode';

export interface IMainThreadEnv {
  $clipboardReadText(): Thenable<string>;
  $clipboardWriteText(value: string): Thenable<void>;
  $asExternalUri(target: vscode.Uri): Promise<UriComponents>;
  $openExternal(target: vscode.Uri): Promise<boolean>;
}

export interface IExtHostEnv {
  $setEnvValues(values: Partial<ExtHostEnvValues>);
  $fireChangeLogLevel(value: KTLogLevel);
  $setLogLevel(value: KTLogLevel);
  logLevel: LogLevel;

  setEnvValues(values: ExtHostEnvValues);
  getEnvValues(): ExtHostEnvValues;
  asExternalUri(target: vscode.Uri): Promise<vscode.Uri>;
  logLevelChangeEmitter: Emitter<LogLevel>;
}

export interface ExtHostEnvValues {
  customVSCodeEngineVersion?: string;
  appName: string;
  uriScheme: string;
  appRoot: string;
  appHost: string;
  language: string;
  uiKind: UIKind;
  firstSessionDate: string | undefined;
}
