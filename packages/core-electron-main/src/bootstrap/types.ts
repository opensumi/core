import { BrowserWindowConstructorOptions } from 'electron';

import { Injector } from '@opensumi/di';
import { ConstructorOf, ExtensionCandidate } from '@opensumi/ide-core-common';
import { IDisposable } from '@opensumi/ide-core-common/lib/disposable';
import { IURLHandler } from '@opensumi/ide-core-common/lib/electron';

import { ElectronMainModule } from '../electron-main-module';

export interface ElectronAppConfig {
  /**
   * BrowserPreload
   */
  browserPreload: string;

  /**
   * 是否在browser层启用node
   */
  browserNodeIntegrated: boolean;

  /**
   * 要加载的模块
   */
  modules: Array<ConstructorOf<ElectronMainModule>>;

  /**
   * node层代码入口
   */
  nodeEntry: string;

  /**
   * browser层代码入口
   */
  browserUrl: string;

  /**
   * extension-host入口
   */
  extensionEntry: string;
  extensionWorkerEntry?: string;

  /**
   * 是否为插件开发模式
   */
  extensionDevelopmentHost?: boolean;

  /**
   * webviewPreload入口
   */
  webviewPreload: string;
  plainWebviewPreload: string;

  /**
   * 插件父级目录
   * extensionDir
   */
  extensionDir: string;

  /**
   * 额外插件目录
   */
  extensionCandidate: ExtensionCandidate[];

  /**
   * 覆盖 browser 层的初始化值
   */
  overrideBrowserOptions?: BrowserWindowConstructorOptions;

  /**
   * 覆盖browser层的WebPreferences配置
   */
  overrideWebPreferences?: { [key: string]: any };

  /**
   * 覆盖 DEFAULT_URI_SCHEME，用来注册 electron protocol 相关的内容
   */
  uriScheme?: string;

  /**
   * 如有外部 injector，优先使用外部
   */
  injector?: Injector;
}

export const ElectronAppConfig = Symbol('ElectronAppConfig');

export const ElectronMainContribution = Symbol('ElectronMainContribution');

export interface ElectronMainContribution {
  registerMainApi?(registry: ElectronMainApiRegistry): void;

  registerURLHandler?(registry: ElectronURLHandlerRegistry): void;

  onStart?(): void;

  beforeAppReady?(): void;
}

export abstract class ElectronMainApiRegistry {
  abstract registerMainApi(name: string, api: IElectronMainApiProvider<any>): IDisposable;
}

export abstract class ElectronURLHandlerRegistry {
  abstract registerURLHandler(handler: IURLHandler): IDisposable;

  abstract registerURLDefaultHandler(handler: IURLHandler): IDisposable;
}

export interface IElectronMainApiProvider<Events = any> {
  eventEmitter?: { fire: (event: Events, ...args: any[]) => void };
}

export class ElectronMainApiProvider<Events = any> implements IElectronMainApiProvider<Events> {
  eventEmitter: { fire: (event: Events, ...args: any[]) => void };
}

export const IElectronMainApp = Symbol('IElectronMainApp');

export interface IElectronMainApp {
  getCodeWindows(): ICodeWindow[];
}

export interface ICodeWindow {
  getBrowserWindow(): Electron.BrowserWindow;

  metadata: any;

  setWorkspace(workspace: string, fsPath?: boolean);

  setExtensionDir(extensionDir: string);

  setExtensionCandidate(extensionCandidate: ExtensionCandidate[]);
}

export interface ICodeWindowOptions {
  extensionDir?: string;
  extensionCandidate?: ExtensionCandidate[];
  query?: { [key: string]: string | string[] };
  /**
   * 指定当前是否通过 remote 模式连接到远程的 Server 端
   * 如果为 true，则会在启动时停止启动本地的服务器，并且在启动时会连接到远程的服务器
   */
  isRemote?: boolean;
}

export interface IParsedArgs {
  extensionDir?: string;
  workspaceDir?: string;
  extensionCandidate: string[];
  extensionDevelopmentPath?: string | string[];
}
