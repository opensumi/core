import { Capturer } from '../../capturer';
import { METHOD_NOT_REGISTERED } from '../../constants';

import { ProxyBase } from './base';

import type { MessageConnection } from '@opensumi/vscode-jsonrpc';

interface IRPCResult {
  error: boolean;
  data: any;
}

export class ProxyJson extends ProxyBase<MessageConnection> {
  protected engine = 'json' as const;
  protected capturer = this._disposables.add(new Capturer(this.engine));

  protected bindMethods(methods: string[]): void {
    for (const method of methods) {
      if (method.startsWith('on')) {
        this.connection.onNotification(method, async (...args: any[]) => {
          this.capturer.captureOnNotification('_', method, args);
          try {
            await this.registry.invoke(method, ...this.serializeArguments(args));
          } catch (e) {
            this.logger.warn(`notification exec ${method} error`, e);
          }
        });
      } else {
        this.connection.onRequest(method, async (...args: any[]) => {
          const requestId = this.nextRequestId();
          this.capturer.captureOnRequest(requestId, method, args);

          try {
            const result = await this.registry.invoke(method, ...this.serializeArguments(args));

            this.capturer.captureOnRequestResult(requestId, method, result);

            return {
              error: false,
              data: result,
            };
          } catch (e) {
            this.capturer.captureOnRequestFail(requestId, method, e);

            return {
              error: true,
              data: {
                message: e.message,
                stack: e.stack,
              },
            };
          }
        });
      }
    }
  }

  async invoke(prop: string, ...args: any[]): Promise<any> {
    await this.connectionPromise.promise;

    let isSingleArray = false;
    if (args.length === 1 && Array.isArray(args[0])) {
      isSingleArray = true;
    }

    // 调用方法为 on 开头时，作为单项通知
    if (prop.startsWith('on')) {
      this.capturer.captureSendNotification('_', prop, args);
      if (isSingleArray) {
        this.connection.sendNotification(prop, [...args]);
      } else {
        this.connection.sendNotification(prop, ...args);
      }
    } else {
      // generate a unique requestId to associate request and requestResult
      const requestId = this.nextRequestId();

      let requestResult: Promise<any>;

      if (isSingleArray) {
        requestResult = this.connection.sendRequest(prop, [...args]) as Promise<any>;
      } else {
        requestResult = this.connection.sendRequest(prop, ...args) as Promise<any>;
      }

      this.capturer.captureSendRequest(requestId, prop, args);

      const result: IRPCResult = await requestResult;

      if (result.error) {
        const error = new Error(result.data.message);
        if (result.data.stack) {
          error.stack = result.data.stack;
        }

        this.capturer.captureSendRequestFail(requestId, prop, result.data);
        throw error;
      } else {
        this.capturer.captureSendRequestResult(requestId, prop, result.data);
        return result.data;
      }
    }
  }

  /**
   * 对于纯数组参数的情况，收到请求/通知后做展开操作
   * 因为在通信层会为每个 rpc 调用添加一个 CancellationToken 参数
   * 如果参数本身是数组, 在方法中如果使用 spread 运算符获取参数(...args)，则会出现 [...args, MutableToken] 这种情况
   * 所以发送请求时将这类参数统一再用数组包了一层，形如 [[...args]], 参考 {@link ProxyJson.get get} 方法
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

  listen(connection: MessageConnection): void {
    super.listen(connection);

    this._disposables.add(
      connection.onRequest((method) => {
        if (!this.registry.has(method)) {
          const requestId = this.nextRequestId();
          this.capturer.captureOnRequest(requestId, method, []);
          const result = {
            data: METHOD_NOT_REGISTERED,
          };
          this.capturer.captureOnRequestFail(requestId, method, result.data);
          return result;
        }
      }),
    );
  }
}
