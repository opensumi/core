import { METHOD_NOT_REGISTERED } from '../constants';
import { Connection } from '../rpc/connection';

import { ProxyBase } from './base';

export class ProxySumi extends ProxyBase<Connection> {
  protected engine = 'sumi' as const;

  protected bindMethods(methods: string[]): void {
    for (const method of methods) {
      if (method.startsWith('on')) {
        this.connection.onNotification(method, async (...args: any[]) => {
          this.captureOnNotification(method, args);
          try {
            await this.runner.run(method, ...args);
          } catch (e) {
            this.logger.warn(`notification exec ${method} error`, e);
          }
        });
      } else {
        this.connection.onRequest(method, async (...args: any[]) => {
          const requestId = this.nextRequestId();
          this.captureOnRequest(requestId, method, args);

          try {
            const result = await this.runner.run(method, ...args);
            this.captureOnRequestResult(requestId, method, result);
            return result;
          } catch (e) {
            this.logger.warn(`request exec ${method} error`, e);
            this.captureOnRequestFail(requestId, method, e);
            throw e;
          }
        });
      }
    }
  }

  getInvokeProxy(): any {
    return new Proxy(this, {
      get: (target, p: string | symbol) => {
        const prop = p.toString();

        return async (...args: any[]) => {
          await this.connectionPromise.promise;

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
      },
    });
  }

  listen(connection: Connection): void {
    super.listen(connection);
    connection.onRequestNotFound((method) => {
      if (!this.runner.has(method)) {
        const requestId = this.nextRequestId();
        this.captureOnRequest(requestId, method, []);
        this.captureOnRequestFail(requestId, method, METHOD_NOT_REGISTERED);
        throw METHOD_NOT_REGISTERED;
      }
    });
  }
}
