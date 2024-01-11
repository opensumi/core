import { uuid } from '@opensumi/ide-core-common';
import { MessageConnection } from '@opensumi/vscode-jsonrpc';

import { METHOD_NOT_REGISTERED } from '../constants';
import { IRPCServiceMap } from '../types';
import { MessageType, ResponseStatus, getServiceMethods } from '../utils';

import { ProxyBase } from './base';

interface IRPCResult {
  error: boolean;
  data: any;
}

export class ProxyLegacy extends ProxyBase<MessageConnection> {
  engine = 'legacy' as const;

  public getInvokeProxy(): any {
    return new Proxy(this, this);
  }

  public get(target: any, p: PropertyKey) {
    const prop = p.toString();
    return async (...args: any[]) => {
      await this.connectionPromise.promise;

      let isSingleArray = false;
      if (args.length === 1 && Array.isArray(args[0])) {
        isSingleArray = true;
      }

      // 调用方法为 on 开头时，作为单项通知
      if (prop.startsWith('on')) {
        if (isSingleArray) {
          this.connection.sendNotification(prop, [...args]);
        } else {
          this.connection.sendNotification(prop, ...args);
        }
        this.capture({ type: MessageType.SendNotification, serviceMethod: prop, arguments: args });
      } else {
        let requestResult: Promise<any>;
        // generate a unique requestId to associate request and requestResult
        const requestId = uuid();

        if (isSingleArray) {
          requestResult = this.connection.sendRequest(prop, [...args]) as Promise<any>;
        } else {
          requestResult = this.connection.sendRequest(prop, ...args) as Promise<any>;
        }

        this.capture({ type: MessageType.SendRequest, requestId, serviceMethod: prop, arguments: args });

        const result: IRPCResult = await requestResult;

        if (result.error) {
          const error = new Error(result.data.message);
          if (result.data.stack) {
            error.stack = result.data.stack;
          }
          this.capture({
            type: MessageType.RequestResult,
            status: ResponseStatus.Fail,
            requestId,
            serviceMethod: prop,
            error: result.data,
          });
          throw error;
        } else {
          this.capture({
            type: MessageType.RequestResult,
            status: ResponseStatus.Success,
            requestId,
            serviceMethod: prop,
            data: result.data,
          });
          return result.data;
        }
      }
    };
  }

  protected bindOnRequest(service: IRPCServiceMap, cb?: ((service: IRPCServiceMap, prop: string) => void) | undefined) {
    if (this.connection) {
      const connection = this.connection;

      const methods = getServiceMethods(service);

      methods.forEach((method) => {
        if (method.startsWith('on')) {
          connection.onNotification(method, (...args) => {
            this.onNotification(method, ...args);
            this.capture({ type: MessageType.OnNotification, serviceMethod: method, arguments: args });
          });
        } else {
          connection.onRequest(method, (...args) => {
            const requestId = uuid();
            const result = this.onRequest(method, ...args);
            this.capture({ type: MessageType.OnRequest, requestId, serviceMethod: method, arguments: args });

            result
              .then((result) => {
                this.capture({
                  type: MessageType.OnRequestResult,
                  status: ResponseStatus.Success,
                  requestId,
                  serviceMethod: method,
                  data: result.data,
                });
              })
              .catch((err) => {
                this.capture({
                  type: MessageType.OnRequestResult,
                  status: ResponseStatus.Fail,
                  requestId,
                  serviceMethod: method,
                  error: err.data,
                });
              });

            return result;
          });
        }

        if (cb) {
          cb(service, method);
        }
      });

      connection.onRequest((method) => {
        if (!this.proxyService[method]) {
          const requestId = uuid();
          this.capture({ type: MessageType.OnRequest, requestId, serviceMethod: method });
          const result = {
            data: METHOD_NOT_REGISTERED,
          };
          this.capture({
            type: MessageType.OnRequestResult,
            status: ResponseStatus.Fail,
            requestId,
            serviceMethod: method,
            error: result.data,
          });
          return result;
        }
      });
    }
  }

  /**
   * 对于纯数组参数的情况，收到请求/通知后做展开操作
   * 因为在通信层会为每个 rpc 调用添加一个 CancellationToken 参数
   * 如果参数本身是数组, 在方法中如果使用 spread 运算符获取参数(...args)，则会出现 [...args, MutableToken] 这种情况
   * 所以发送请求时将这类参数统一再用数组包了一层，形如 [[...args]], 参考 {@link ProxyLegacy.get get} 方法
   * 此时接收到的数组类参数固定长度为 2，且最后一项一定是 MutableToken
   * @param args
   * @returns args
   */
  private serializeArguments(args: any[]): any[] {
    const maybeCancellationToken = args[args.length - 1];
    if (
      args.length === 2 &&
      Array.isArray(args[0]) &&
      Object.prototype.hasOwnProperty.call(maybeCancellationToken, '_isCancelled')
    ) {
      return [...args[0], maybeCancellationToken];
    }

    return args;
  }

  private async onRequest(prop: PropertyKey, ...args: any[]) {
    try {
      const result = await this.proxyService[prop](...this.serializeArguments(args));

      return {
        error: false,
        data: result,
      };
    } catch (e) {
      return {
        error: true,
        data: {
          message: e.message,
          stack: e.stack,
        },
      };
    }
  }

  private onNotification(prop: PropertyKey, ...args: any[]) {
    try {
      this.proxyService[prop](...this.serializeArguments(args));
    } catch (e) {
      this.logger.warn('notification', e);
    }
  }
}
