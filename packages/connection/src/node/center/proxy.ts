import {MessageConnection} from '@ali/vscode-jsonrpc';

export abstract class RPCService {
  rpcClient?: any[];
  rpcRegistered?: boolean;
  register?(): () => Promise<any>;
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
    return new Proxy({}, {
      get: (target, prop: string | symbol) => {
        if (this.reservedWords.includes(prop as string) || typeof prop === 'symbol') {
          return Promise.resolve();
        } else {
          return this.proxy[prop];
        }
      },
    });
  }
}

interface IRPCResult {
  error: boolean;
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

    return (...args: any[]) => {
      return this.connectionPromise.then((connection) => {
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
              } else {
                connection.sendNotification(prop, ...args);
              }

              resolve();
            } else {
              let requestResult: Promise<any>;
              if (isSingleArray) {
                requestResult = connection.sendRequest(prop, [...args]) as Promise<any>;
              } else {
                requestResult = connection.sendRequest(prop, ...args) as Promise<any>;
              }

              requestResult.catch((err) => { reject(err); })
              .then((result: IRPCResult) => {
                if (result.error) {
                  const error = new Error(result.data.message);
                  if (result.data.stack) {
                    error.stack = result.data.stack;
                  }
                  reject(error);
                } else {
                  resolve(result.data);
                }

              });
            }
          } catch (e) {}
        });
      });

    };
  }
  private getServiceMethod(service): string[] {
    let props: any[] = [];

    if (/^\s*class/.test(service.constructor.toString())) {
      let obj = service;
      do {
          props = props.concat(Object.getOwnPropertyNames(obj));
      } while (obj = Object.getPrototypeOf(obj));
      props = props.sort().filter((e, i, arr) => {
        return e !== arr[i + 1] && typeof service[e] === 'function';
      });
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
          connection.onNotification(method, (...args) => this.onNotification(method, ...args));
        } else {
          connection.onRequest(method, (...args) => this.onRequest(method, ...args));
        }

        if (cb) {
          cb(service, method);
        }
      });

      connection.onRequest((method) => {
        if (!this.proxyService[method]) {
          return {
            error: false,
            data: NOTREGISTERMETHOD,
          };
        }
      });
    }
  }
  private waitForConnection() {
    this.connectionPromise = new Promise((resolve) => {
      this.connectionPromiseResolve = resolve;
    });
  }
  private async onRequest(prop: PropertyKey, ...args: any[]) {
    // if (prop === '$$call') {
    //   try {
    //     const method = args[0];
    //     const methodArgs = args.slice(1).map((arg: any) => {
    //       return eval(arg);
    //     });

    //     return eval(`this.proxyService.${method}(...methodArgs)`);
    //   } catch (e) {}
    // } else {
      try {
        const result = await this.proxyService[prop](...args);

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

    // }
  }
  private onNotification(prop: PropertyKey, ...args: any[]) {
    try {
      this.proxyService[prop](...args);
    } catch (e) {
      this.logger.warn('notification', e);
    }
  }

}
