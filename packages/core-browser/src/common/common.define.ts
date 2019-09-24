import { MaybePromise } from '@ali/ide-core-common';
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
}
