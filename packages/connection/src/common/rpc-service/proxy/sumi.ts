import { METHOD_NOT_REGISTERED } from '../../constants';
import { Connection } from '../../rpc/connection';

import { ProxyBase } from './base';

export class ProxySumi extends ProxyBase<Connection> {
  protected engine = 'sumi' as const;

  protected bindMethods(methods: string[]): void {
    for (const method of methods) {
      if (method.startsWith('on')) {
        this.connection.onNotification(method, async (...args: any[]) => {
          this.captureOnNotification(method, args);
          try {
            await this.registry.invoke(method, ...args);
          } catch (e) {
            this.logger.warn(`notification exec ${method} error`, e);
          }
        });
      } else {
        this.connection.onRequest(method, async (...args: any[]) => {
          const requestId = this.nextRequestId();
          this.captureOnRequest(requestId, method, args);

          try {
            const result = await this.registry.invoke(method, ...args);
            this.captureOnRequestResult(requestId, method, result);
            return result;
          } catch (e) {
            this.captureOnRequestFail(requestId, method, e);
            throw e;
          }
        });
      }
    }
  }

  public getInvokeProxy<T = any>(): T {
    return new Proxy(Object.create(null), {
      get: (target: any, p: PropertyKey) => {
        if (!target[p]) {
          target[p] = async (...args: any[]) => {
            await this.connectionPromise.promise;
            const prop = p.toString();

            // 调用方法为 on 开头时，作为单项通知
            if (prop.startsWith('on')) {
              this.captureSendNotification(prop, args);
              this.connection.sendNotification(prop, ...args);
            } else {
              // generate a unique requestId to associate request and requestResult
              const requestId = this.nextRequestId();
              this.captureSendRequest(requestId, prop, args);
              try {
                const result = await this.connection.sendRequest(prop, ...args);
                this.captureSendRequestResult(requestId, prop, result);
                return result;
              } catch (error) {
                this.captureSendRequestFail(requestId, prop, error);
                throw error;
              }
            }
          };
        }
        return target[p];
      },
    });
  }

  listen(connection: Connection): void {
    super.listen(connection);
    connection.onRequestNotFound((method) => {
      if (!this.registry.has(method)) {
        const requestId = this.nextRequestId();
        this.captureOnRequest(requestId, method, []);
        this.captureOnRequestFail(requestId, method, METHOD_NOT_REGISTERED);
        throw METHOD_NOT_REGISTERED;
      }
    });
  }
}
