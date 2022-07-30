import { ApplicationError } from '@opensumi/ide-core-common';
import type { MessageConnection } from '@opensumi/vscode-jsonrpc/lib/common/connection';

import { getCapturer, generateUniqueId } from './utils';

export abstract class RPCService<T = any> {
  rpcClient?: T[];
  rpcRegistered?: boolean;
  register?(): () => Promise<T>;
  get client() {
    return this.rpcClient ? this.rpcClient[0] : undefined;
  }
}

export const NOTREGISTERMETHOD = '$$NOTREGISTERMETHOD';

export class ProxyClient {
  public proxy: any;
  public reservedWords: string[];

  constructor(proxy: any, reservedWords = ['then']) {
    this.proxy = proxy;
    this.reservedWords = reservedWords;
  }
  public getClient() {
    return new Proxy(
      {},
      {
        get: (target, prop: string | symbol) => {
          if (this.reservedWords.includes(prop as string) || typeof prop === 'symbol') {
            return Promise.resolve();
          } else {
            return this.proxy[prop];
          }
        },
      },
    );
  }
}

interface IRPCResult {
  error?: ApplicationError<number, any>;
  data: any;
}
export class RPCProxy {
  private connectionPromise: Promise<MessageConnection>;
  private connectionPromiseResolve: (connection: MessageConnection) => void;
  private connection: MessageConnection;
  private proxyService: any = {};
  private logger: any;

  constructor(public target?: RPCService, logger?: any) {
    this.waitForConnection();
    this.logger = logger || console;
  }
  public listenService(service) {
    if (this.connection) {
      const proxyService = this.proxyService;
      this.bindOnRequest(service, (service, prop) => {
        proxyService[prop] = service[prop].bind(service);
      });
    } else {
      const target = this.target || {};
      const methods = this.getServiceMethod(service);
      methods.forEach((method) => {
        target[method] = service[method].bind(service);
      });
    }
  }

  public listen(connection: MessageConnection) {
    this.connection = connection;

    if (this.target) {
      this.listenService(this.target);
    }
    this.connectionPromiseResolve(connection);
    connection.listen();
  }

  public createProxy(): any {
    const proxy = new Proxy(this, this);

    const proxyClient = new ProxyClient(proxy);
    return proxyClient.getClient();
  }
  public get(target: any, p: PropertyKey) {
    const prop = p.toString();

    return (...args: any[]) =>
      this.connectionPromise.then((connection) => {
        connection = this.connection || connection;
        return new Promise((resolve, reject) => {
          try {
            let isSingleArray = false;
            if (args.length === 1 && Array.isArray(args[0])) {
              isSingleArray = true;
            }
            // 调用方法为 on 开头时，作为单项通知
            if (prop.startsWith('on')) {
              if (isSingleArray) {
                connection.sendNotification(prop, [...args]);
                getCapturer() &&
                  getCapturer()({
                    type: 'sendNotification',
                    serviceMethod: prop,
                    arguments: args,
                  });
              } else {
                connection.sendNotification(prop, ...args);
                getCapturer() &&
                  getCapturer()({
                    type: 'sendNotification',
                    serviceMethod: prop,
                    arguments: args,
                  });
              }

              resolve(null);
            } else {
              let requestResult: Promise<any>;
              // generate a unique requestId to associate request and requestResult
              const requestId = generateUniqueId();

              if (isSingleArray) {
                requestResult = connection.sendRequest(prop, [...args]) as Promise<any>;
                getCapturer() &&
                  getCapturer()({
                    type: 'sendRequest',
                    requestId,
                    serviceMethod: prop,
                    arguments: args,
                  });
              } else {
                requestResult = connection.sendRequest(prop, ...args) as Promise<any>;
                getCapturer() &&
                  getCapturer()({
                    type: 'sendRequest',
                    requestId,
                    serviceMethod: prop,
                    arguments: args,
                  });
              }

              requestResult
                .catch((err) => {
                  reject(err);
                })
                .then((result: IRPCResult) => {
                  if (result.error) {
                    const error = new Error(result.data.message);
                    if (result.data.stack) {
                      error.stack = result.data.stack;
                    }
                    if (result.error.code && result.error.data) {
                      // 经过通信，applicationError 实例的构造类信息丢失了，使用 fromJson 恢复
                      const applicationError = ApplicationError.fromJson(result.error.code, result.error.data);
                      error.cause = applicationError;
                    }
                    getCapturer() &&
                      getCapturer()({
                        type: 'requestResult',
                        status: 'fail',
                        requestId,
                        error: result.data,
                      });
                    reject(error);
                  } else {
                    getCapturer() &&
                      getCapturer()({
                        type: 'requestResult',
                        status: 'success',
                        requestId,
                        data: result.data,
                      });
                    resolve(result.data);
                  }
                });
            }
          } catch (e) {}
        });
      });
  }
  private getServiceMethod(service): string[] {
    let props: any[] = [];

    if (/^\s*class/.test(service.constructor.toString())) {
      let obj = service;
      do {
        props = props.concat(Object.getOwnPropertyNames(obj));
      } while ((obj = Object.getPrototypeOf(obj)));
      props = props.sort().filter((e, i, arr) => e !== arr[i + 1] && typeof service[e] === 'function');
    } else {
      for (const prop in service) {
        if (service[prop] && typeof service[prop] === 'function') {
          props.push(prop);
        }
      }
    }

    return props;
  }
  private bindOnRequest(service, cb?) {
    if (this.connection) {
      const connection = this.connection;

      const methods = this.getServiceMethod(service);
      methods.forEach((method) => {
        if (method.startsWith('on')) {
          connection.onNotification(method, (...args) => {
            getCapturer() &&
              getCapturer()({
                type: 'onNotification',
                serviceMethod: method,
                arguments: args,
              });
            this.onNotification(method, ...args);
          });
        } else {
          connection.onRequest(method, (...args) => {
            // *** capturer ***
            const requestId = generateUniqueId();
            getCapturer() &&
              getCapturer()({
                type: 'onRequest',
                requestId,
                serviceMethod: method,
                arguments: args,
              });
            // ****************
            const result = this.onRequest(method, ...args);
            // *** capturer ***
            result
              .then((result) => {
                getCapturer() &&
                  getCapturer()({
                    type: 'onRequestResult',
                    status: 'success',
                    requestId,
                    data: result.data,
                  });
              })
              .catch((err) => {
                getCapturer() &&
                  getCapturer()({
                    type: 'onRequestResult',
                    status: 'fail',
                    requestId,
                    error: err.data,
                  });
              });
            // ****************
            return result;
          });
        }

        if (cb) {
          cb(service, method);
        }
      });

      connection.onRequest((method) => {
        if (!this.proxyService[method]) {
          // *** capturer ***
          const requestId = generateUniqueId();
          getCapturer() &&
            getCapturer()({
              type: 'onRequest',
              requestId,
              serviceMethod: method,
            });
          // ****************
          const result = {
            data: NOTREGISTERMETHOD,
          };
          // *** capturer ***
          getCapturer() &&
            getCapturer()({
              type: 'onRequestResult',
              status: 'fail',
              requestId,
              error: result.data,
            });
          // ****************
          return result;
        }
      });
    }
  }

  private waitForConnection() {
    this.connectionPromise = new Promise((resolve) => {
      this.connectionPromiseResolve = resolve;
    });
  }

  /**
   * 对于纯数组参数的情况，收到请求/通知后做展开操作
   * 因为在通信层会为每个 rpc 调用添加一个 CancellationToken 参数
   * 如果参数本身是数组, 在方法中如果使用 spread 运算符获取参数(...args)，则会出现 [...args, MutableToken] 这种情况
   * 所以发送请求时将这类参数统一再用数组包了一层，形如 [[...args]], 参考 {@link RPCProxy.get get} 方法
   * 此时接收到的数组类参数固定长度为 2，且最后一项一定是 MutableToken
   * @param args
   * @returns args
   */
  private serializeArguments(args: any[]): any[] {
    const maybeCancellationToken = args[args.length - 1];
    if (args.length === 2 && Array.isArray(args[0]) && maybeCancellationToken.hasOwnProperty('_isCancelled')) {
      return [...args[0], maybeCancellationToken];
    }

    return args;
  }

  private async onRequest(prop: PropertyKey, ...args: any[]) {
    try {
      const result = await this.proxyService[prop](...this.serializeArguments(args));

      return {
        data: result,
      };
    } catch (e) {
      return {
        error: e,
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
