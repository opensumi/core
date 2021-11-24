import { createMainContextProxyIdentifier } from '@opensumi/ide-connection';

export interface IMainThreadExtensionLog {
  $verbose(...args: any[]): Promise<void>;
  $debug(...args: any[]): Promise<void>;
  $log(...args: any[]): Promise<void>;
  $warn(...args: any[]): Promise<void>;
  $error(...args: any[]): Promise<void>;
  $critical(...args: any[]): Promise<void>;
  $dispose(): Promise<void>;
}

export const MainThreadExtensionLogIdentifier = createMainContextProxyIdentifier<IMainThreadExtensionLog>('MainThreadExtensionLog');
