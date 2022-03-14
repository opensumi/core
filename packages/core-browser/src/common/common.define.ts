import { MaybePromise } from '@opensumi/ide-core-common';

import { IClientApp } from '../browser-module';

export const ClientAppContribution = Symbol('ClientAppContribution');

export interface ClientAppContribution {
  /**
   * Called on application startup before commands, key bindings and menus are initialized.
   * Should return a promise if it runs asynchronously.
   */
  initialize?(app: IClientApp): MaybePromise<void>;

  /**
   * Called when the application is started. The application shell is not attached yet when this method runs.
   * Should return a promise if it runs asynchronously.
   */
  onStart?(app: IClientApp): MaybePromise<void>;

  /**
   * 大部分模块启动完成
   * @param app
   */
  onDidStart?(app: IClientApp): MaybePromise<void>;

  /**
   * Called on `beforeunload` event, right before the window closes.
   * Return `true` in order to prevent exit.
   * Note: No async code allowed, this function has to run on one tick.
   * electron可以使用Promise, web上若返回promise，视为true
   */
  onWillStop?(app: IClientApp): MaybePromise<boolean | void>;

  /**
   * Called when an application is stopped or unloaded.
   *
   * Note that this is implemented using `window.unload` which doesn't allow any asynchronous code anymore.
   * I.e. this is the last tick.
   * electron可以使用Promise, web上若返回promise会无效
   */
  onStop?(app: IClientApp): MaybePromise<void>;

  /**
   * 用于处理一些副作用清理工作，通过调用 clientApp.dispose 触发
   * 与 onStop 不同的是，onStop 仅适用于非阻塞性的工作
   * onDisposeEffect 适用于一些耗时较长的阻塞性任务，适用于将 IDE 作为大组件优雅卸载的场景
   * 但 onDisposeEffect 在 Electron 下可能会阻塞窗口关闭(例如需要1s以上时间关闭)
   */
  onDisposeSideEffects?(app: IClientApp): void;

  /**
   *
   */
  onReconnect?(app: IClientApp): void;
}
