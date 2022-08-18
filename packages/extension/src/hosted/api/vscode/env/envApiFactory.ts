import { createHash } from 'crypto';

import address from 'address';
import { v4 } from 'uuid';
import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import { Event } from '@opensumi/ide-core-common';

import {
  IExtensionDescription,
  IExtHostEnv,
  IExtHostTerminal,
  IMainThreadEnv,
  MainThreadAPIIdentifier,
} from '../../../../common/vscode';
import { LogLevel } from '../../worker/worker.ext-types';

export class Env {
  private macMachineId: string;
  public sessionId: string;

  constructor() {
    address.mac((err, macAddress) => {
      if (!err && macAddress) {
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

export const envValue = new Env();

export function createEnvApiFactory(
  rpcProtocol: IRPCProtocol,
  extension: IExtensionDescription,
  envHost: IExtHostEnv,
  exthostTerminal: IExtHostTerminal,
): typeof vscode.env {
  const proxy: IMainThreadEnv = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadEnv);
  const values = envHost.getEnvValues();
  const env = {
    appName: values.appName,
    appRoot: values.appRoot,
    appHost: values.appHost,
    uriScheme: values.uriScheme,
    language: values.language,
    sessionId: envValue.sessionId,
    machineId: envValue.machineId,
    remoteName: 'remoteName',
    shell: exthostTerminal.shellPath,
    uiKind: values.uiKind,
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
    asExternalUri(target: vscode.Uri): Thenable<vscode.Uri> {
      return envHost.asExternalUri(target);
    },
    get logLevel() {
      return envHost.logLevel;
    },
    get onDidChangeLogLevel(): Event<LogLevel> {
      return envHost.logLevelChangeEmitter.event;
    },
    get environmentVariableCollection(): vscode.EnvironmentVariableCollection {
      return exthostTerminal.getEnviromentVariableCollection(extension);
    },
    get isNewAppInstall() {
      const { firstSessionDate } = values;

      if (!firstSessionDate) {
        return true;
      }

      const installAge = Date.now() - new Date(firstSessionDate).getTime();

      return isNaN(installAge) ? false : installAge < 1000 * 60 * 60 * 24; // install age is less than a day
    },
    /**
     * 兼容 vscode api 用，该 api 主要与用户个人数据收集相关：https://privacy.microsoft.com/zh-cn/privacystatement
     */
    get isTelemetryEnabled() {
      return false;
    },
    /**
     * 同 isTelemetryEnabled
     */
    get onDidChangeTelemetryEnabled(): Event<boolean> {
      return Event.None as Event<boolean>;
    },
  };

  return Object.freeze(env);
}
