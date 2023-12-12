import { BinaryConnection } from '../sumi-rpc/connection';
import { IRPCServiceMap } from '../types';

import { ProxyBase } from './base';

export class ProxySumi extends ProxyBase<BinaryConnection> {
  protected bindOnRequest(service: IRPCServiceMap, cb: (service: IRPCServiceMap, prop: string) => void): void {
    Object.entries(service).forEach(([name, value]) => {
      if (!value) {
        return;
      }

      cb(service, name);

      if (name.startsWith('on')) {
        this.connection.onNotification(name, async (...argsArray: any[]) => {
          try {
            await this.proxyService[name](...argsArray);
          } catch (e) {
            this.logger.warn(`notification exec ${name} error`, e);
          }
        });
      } else {
        this.connection.onRequest(name, async (...argsArray: any[]) => {
          try {
            return await this.proxyService[name](...argsArray);
          } catch (e) {
            this.logger.warn(`request exec ${name} error`, e);
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

        return (...args: any[]) =>
          this.connectionPromise.promise.then(async (connection) => {
            if (prop.startsWith('on')) {
              connection.sendNotification(prop, ...args);
            } else {
              return await connection.sendRequest(prop, ...args);
            }
          });
      },
    });
  }
}
