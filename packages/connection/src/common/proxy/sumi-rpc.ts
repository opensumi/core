import { uuid } from '@opensumi/ide-core-common';

import { BinaryConnection } from '../sumi-rpc/connection';
import { IRPCServiceMap } from '../types';
import { MessageType, ResponseStatus } from '../utils';

import { ProxyBase } from './base';

export class ProxySumi extends ProxyBase<BinaryConnection> {
  proxyType = 'sumi-rpc' as const;
  protected bindOnRequest(service: IRPCServiceMap, cb: (service: IRPCServiceMap, prop: string) => void): void {
    Object.entries(service).forEach(([method, value]) => {
      if (!value) {
        return;
      }

      cb(service, method);

      if (method.startsWith('on')) {
        this.connection.onNotification(method, async (...args: any[]) => {
          this.capture({ type: MessageType.OnNotification, serviceMethod: method, arguments: args });

          try {
            await this.proxyService[method](...args);
          } catch (e) {
            this.logger.warn(`notification exec ${method} error`, e);
          }
        });
      } else {
        this.connection.onRequest(method, async (...args: any[]) => {
          const requestId = uuid();
          this.capture({ type: MessageType.OnRequest, requestId, serviceMethod: method, arguments: args });

          try {
            const result = await this.proxyService[method](...args);
            this.capture({
              type: MessageType.OnRequestResult,
              status: ResponseStatus.Success,
              requestId,
              serviceMethod: method,
              data: result,
            });
            return result;
          } catch (e) {
            this.logger.warn(`request exec ${method} error`, e);
            this.capture({
              type: MessageType.OnRequestResult,
              status: ResponseStatus.Fail,
              requestId,
              serviceMethod: method,
              error: e,
            });
            throw e;
          }
        });
      }
    });
  }

  getInvokeProxy(): any {
    return new Proxy(this, {
      get: (target, p: string | symbol) => {
        const prop = p.toString();

        return async (...args: any[]) => {
          await this.connectionPromise.promise;

          if (prop.startsWith('on')) {
            this.connection.sendNotification(prop, ...args);
            this.capture({ type: MessageType.SendNotification, serviceMethod: prop, arguments: args });
          } else {
            // generate a unique requestId to associate request and requestResult
            const requestId = uuid();
            this.capture({ type: MessageType.SendRequest, requestId, serviceMethod: prop, arguments: args });
            try {
              const result = await this.connection.sendRequest(prop, ...args);
              this.capture({
                type: MessageType.RequestResult,
                status: ResponseStatus.Success,
                requestId,
                serviceMethod: prop,
                data: result,
              });
              return result;
            } catch (error) {
              this.capture({
                type: MessageType.RequestResult,
                status: ResponseStatus.Fail,
                requestId,
                serviceMethod: prop,
                error,
              });

              throw error;
            }
          }
        };
      },
    });
  }
}
