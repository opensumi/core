import { MessageConnection } from '@opensumi/vscode-jsonrpc';

import { METHOD_NOT_REGISTERED } from '../constants';

import { ProxyBase } from './base';

interface IRPCResult {
  error: boolean;
  data: any;
}

export class ProxyLegacy extends ProxyBase<MessageConnection> {
  engine = 'legacy' as const;

  public getInvokeProxy<T = any>(): T {
    return new Proxy(Object.create(null), {
      get: (target: any, p: PropertyKey) => {
        const prop = p.toString();

        if (!target[p]) {
          target[p] = async (...args: any[]) => {
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
              this.captureSendNotification(prop, args);
            } else {
              let requestResult: Promise<any>;
              // generate a unique requestId to associate request and requestResult
              const requestId = this.nextRequestId();

              if (isSingleArray) {
                requestResult = this.connection.sendRequest(prop, [...args]) as Promise<any>;
              } else {
                requestResult = this.connection.sendRequest(prop, ...args) as Promise<any>;
              }

              this.captureSendRequest(requestId, prop, args);

              const result: IRPCResult = await requestResult;

              if (result.error) {
                const error = new Error(result.data.message);
                if (result.data.stack) {
                  error.stack = result.data.stack;
                }

                this.captureSendRequestFail(requestId, prop, result.data);
                throw error;
              } else {
                this.captureSendRequestResult(requestId, prop, result.data);
                return result.data;
              }
            }
          };
        }

        return target[p];
      },
    });
  }

  protected bindMethods(methods: string[]) {
    methods.forEach((method) => {
      if (method.startsWith('on')) {
        this.connection.onNotification(method, (...args) => {
          this.onNotification(method, ...args);
          this.captureOnNotification(method, args);
        });
      } else {
        this.connection.onRequest(method, (...args) => {
          const requestId = this.nextRequestId();
          const result = this.onRequest(method, ...args);
          this.captureOnRequest(requestId, method, args);
          result
            .then((result) => {
              this.captureOnRequestResult(requestId, method, result.data);
            })
            .catch((err) => {
              this.captureOnRequestFail(requestId, method, err.data);
            });

          return result;
        });
      }
    });
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
      const result = await this.runner.run(prop, ...this.serializeArguments(args));

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
      this.runner.run(prop as any, ...this.serializeArguments(args));
    } catch (e) {
      this.logger.warn('notification', e);
    }
  }

  listen(connection: MessageConnection): void {
    super.listen(connection);

    connection.onRequest((method) => {
      if (!this.runner.has(method)) {
        const requestId = this.nextRequestId();
        this.captureOnRequest(requestId, method, []);
        const result = {
          data: METHOD_NOT_REGISTERED,
        };
        this.captureOnRequestFail(requestId, method, result.data);
        return result;
      }
    });
  }
}
