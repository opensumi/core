import {MessageConnection} from '@ali/vscode-jsonrpc';

export abstract class RPCService {
  rpcClient?: any[];
  rpcRegistered?: boolean;
  register?(): () => Promise<any>;
}

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

  constructor(public target?: RPCService) {
    this.waitForConnection();
  }
  // public reListen(){
  //   if(this.connection){
  //     const service = this.proxyService
  //   }
  // }
  public listenService(service: RPCService) {
    if (this.connection) {
      const proxyService = this.proxyService;
      this.bindOnRequest(service, (service, prop) => {
        proxyService[prop] = service[prop].bind(service);
      });
    }
  }
  public listenNested() {
    if (this.connection) {
      const connection = this.connection;
      connection.onRequest('$$call', (...args) => this.onRequest('$$call', ...args));
    }
  }
  public listen(connection: MessageConnection) {
    this.connection = connection;
    // if(Object.keys(this.proxyService).length){
    //   this.listenService(this.proxyService)
    if (this.target) {
      this.listenService(this.target);
    }
    this.connectionPromiseResolve(connection);

    if (connection.isListening && !connection.isListening()) {
      connection.listen();
      connection.onRequest(() => {
        return {
          error: true,
          data: {
            message: 'no remote method',
          },
        };
      });
    }
  }

  public createProxy() {
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
            // 调用方法为 on 时
            if (prop.startsWith('on')) {
              connection.sendNotification(prop, ...args);
            } else {
              const requestResult: Promise<any> = connection.sendRequest(prop, ...args) as Promise<any>;
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
          } catch (e) {
            reject(e);
          }
        });
      });

    };
  }
  private bindOnRequest(service, cb?) {
    if (this.connection) {
      const connection = this.connection;

      // target 为 es6 时的方法挂载
      if (/^\s*class/.test(service.constructor.toString())) {
        let props: any[] = [];
        let obj = service;
        do {
            props = props.concat(Object.getOwnPropertyNames(obj));
        } while (obj = Object.getPrototypeOf(obj));
        props = props.sort().filter((e, i, arr) => {
          return e !== arr[i + 1] && typeof service[e] === 'function';
        });

        for (let i = 0, len = props.length; i < len; i++) {
          const prop = props[i];
          if (prop === 'constructor' || !(service[prop] instanceof Function)) { continue; }
          connection.onRequest(prop, (...args) => this.onRequest(prop, ...args));
          connection.onNotification(prop, (...args) => this.onNotification(prop, ...args));

          if (cb) {
            cb(service, prop);
          }
        }
      // 常规对象或 target 为 es5 时的方法挂载
      } else {
        for (const prop in service) {
          if (typeof service[prop] === 'function') {
            connection.onRequest(prop, (...args) => this.onRequest(prop, ...args));
            connection.onNotification(prop, (...args) => this.onNotification(prop, ...args));

            if (cb) {
              cb(service, prop);
            }
          }
        }
      }
    }
  }
  private waitForConnection() {
    this.connectionPromise = new Promise((resolve) => {
      this.connectionPromiseResolve = resolve;
    });
  }
  private async onRequest(prop: PropertyKey, ...args: any[]) {
    if (prop === '$$call') {
      try {
        const method = args[0];
        const methodArgs = args[1].map((arg: any) => {
          return eval(arg);
        });

        return eval(`this.proxyService.${method}(...methodArgs)`);
      } catch (e) {}
    } else {
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
    }
  }
  private onNotification(prop: PropertyKey, ...args: any[]) {
    try {
      this.proxyService[prop](...args);
    } catch (e) {
      console.log('notification', e);
    }
  }

}
