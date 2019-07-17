import { ConstructorOf } from '@ali/ide-core-common';
import { ElectronMainModule } from '../electron-main-module';
import { IDisposable } from '@ali/ide-core-common/lib/lifecycle';

export interface ElectronAppConfig {

  /**
   * 是否在browser层启用node
   */
  browserNodeIntegrated: boolean;

  /**
   * browser的webPreferences
   */
  webPreferences?: any;

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

}

export const ElectronAppConfig = Symbol('ElectronAppConfig');

export const ElectronMainContribution = Symbol('ElectronMainContribution');

export interface ElectronMainContribution {

  registerMainApi(registry: ElectronMainApiRegistry);

}

export abstract class ElectronMainApiRegistry {

  abstract registerMainApi(name: string, api: ElectronMainApiProvider<any>): IDisposable;

}

export class ElectronMainApiProvider<Events = any> {

  public eventEmitter: { fire: (event: Events, ...args: any[]) => void};

}

export const IElectronMainApp = Symbol('IElectronMainApp');

export interface IElectronMainApp {

  getCodeWindows(): ICodeWindow[];

}

export interface ICodeWindow {

  getBrowserWindow(): Electron.BrowserWindow;

}
