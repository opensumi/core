import { BrowserWindowConstructorOptions } from 'electron';
import { ConstructorOf } from '@ali/ide-core-common';
import { ElectronMainModule } from '../electron-main-module';
import { IDisposable } from '@ali/ide-core-common/lib/disposable';
import { ExtensionCandidate } from '@ali/ide-core-common';

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
}

export const ElectronAppConfig = Symbol('ElectronAppConfig');

export const ElectronMainContribution = Symbol('ElectronMainContribution');

export interface ElectronMainContribution {

  registerMainApi?(registry: ElectronMainApiRegistry);

  onStart?();

  beforeAppReady?();

}

export abstract class ElectronMainApiRegistry {

  abstract registerMainApi(name: string, api: IElectronMainApiProvider<any>): IDisposable;

}

export interface IElectronMainApiProvider<Events = any> {

  eventEmitter?: { fire: (event: Events, ...args: any[]) => void};

}

export class ElectronMainApiProvider<Events = any> implements IElectronMainApiProvider<Events> {

  eventEmitter: { fire: (event: Events, ...args: any[]) => void};

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
  query?: { [key: string]: string | string[]; };
}

export interface IParsedArgs {
  extensionDir?: string;
  workspaceDir?: string;
  extensionCandidate: string[];
  extensionDevelopmentPath?: string | string[];
}
