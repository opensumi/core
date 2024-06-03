import { METHOD_NOT_REGISTERED } from '../../constants';
import { SumiConnection } from '../../rpc/connection';

import { ProxyBase } from './base';

export class ProxySumi extends ProxyBase<SumiConnection> {
  protected engine = 'sumi' as const;

  protected bindMethods(methods: string[]): void {
    for (const method of methods) {
      if (method.startsWith('on')) {
        this.connection.onNotification(method, async (...args: any[]) => {
          try {
            await this.registry.invoke(method, ...args);
          } catch (e) {
            this.logger.warn(`notification exec ${method} error`, e);
          }
        });
      } else {
        this.connection.onRequest(method, async (...args: any[]) => await this.registry.invoke(method, ...args));
      }
    }
  }

  async invoke(prop: string, ...args: any[]): Promise<any> {
    await this.connectionPromise.promise;

    // 调用方法为 on 开头时，作为单项通知
    if (prop.startsWith('on')) {
      this.connection.sendNotification(prop, ...args);
    } else {
      return await this.connection.sendRequest(prop, ...args);
    }
  }

  listen(connection: SumiConnection): void {
    super.listen(connection);
    this._disposables.add(
      connection.onRequestNotFound(() => {
        throw METHOD_NOT_REGISTERED;
      }),
    );
  }
}
