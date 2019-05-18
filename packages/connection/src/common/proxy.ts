import {MessageConnection} from '@ali/vscode-jsonrpc';

export abstract class RPCService {
  [key: string]: any
  // servicePath: string

  rpcClient?: any[];
  rpcRegistered?: boolean;
  register?(): () => Promise<any>;
}

export class ProxyClient {
  public proxy: any;
  public reservedWords: string[];

  constructor(proxy: any, reservedWords = ['then', 'Symbol']) {
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

export class RPCProxy {
  private connectionPromise: Promise<MessageConnection>;
  private connectionPromiseResolve: (connection: MessageConnection) => void;
  private connection: MessageConnection;
  private proxyService: any = {};

  constructor(public target?: RPCService) {
    this.waitForConnection();
  }
  public listenService(service: RPCService) {
    if (this.connection) {
      const connection = this.connection;
      const proxyService = this.proxyService;

      if (/^\s*class/.test(service.constructor.toString())) {
        let props: any[] = [];
        let obj = service;
        do {
            props = props.concat(Object.getOwnPropertyNames(obj));
        } while (obj = Object.getPrototypeOf(obj));
        props = props.sort().filter((e, i, arr) => {
          return e !== arr[i + 1] && typeof service[e] === 'function';
        });

        console.log('props', props);
        for (let i = 0, len = props.length; i < len; i++) {
          const prop = props[i];
          if (prop === 'constructor' || !(service[prop] instanceof Function)) { continue; }
          connection.onRequest(prop, (...args) => this.onRequest(prop, ...args));
          connection.onNotification(prop, (...args) => this.onNotification(prop, ...args));

          proxyService[prop] = service[prop].bind(service);
        }
      } else {
        for (const prop in service) {
          if (typeof service[prop] === 'function') {
            connection.onRequest(prop, (...args) => this.onRequest(prop, ...args));
            connection.onNotification(prop, (...args) => this.onNotification(prop, ...args));

            proxyService[prop] = service[prop].bind(service);
          }
        }
      }
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
    if (this.target) {
      this.listenService(this.target);
    }
    this.connectionPromiseResolve(connection);

    if (connection.isListening && !connection.isListening()) {
      connection.listen();
    }
  }

  public createProxy() {
    const proxy = new Proxy(this, this);
    // return proxy;

    const proxyClient = new ProxyClient(proxy);
    return proxyClient.getClient();
  }
  public get(target: any, p: PropertyKey) {
    const prop = p.toString();

    return (...args: any[]) => {
      return this.connectionPromise.then((connection) => {
        return new Promise((resolve, reject) => {
          try {
            if (prop.startsWith('on')) {
              connection.sendNotification(prop, ...args);
            } else {
              const requestResult: Promise<any> = connection.sendRequest(prop, ...args) as Promise<any>;
              requestResult.catch((err) => { reject(err); })
                        .then((result) => {resolve(result); });
            }
          } catch (e) {}
        });
      });

    };
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
        console.log('onRequest result', result);
        return result;
      } catch (e) {}
    }
  }
  private onNotification(prop: PropertyKey, ...args: any[]) {
    this.proxyService[prop](...args);
  }

}
