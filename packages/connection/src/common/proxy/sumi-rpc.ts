import { PlatformBuffer } from '@opensumi/ide-core-common/lib/connection/types';

import { ProtocolRepository } from '../protocol-repository';
import { BinaryConnection } from '../sumi-rpc/connection';
import { IRPCServiceMap } from '../types';

import { ProxyBase } from './base';

export class ProxySumi extends ProxyBase<BinaryConnection, IRPCServiceMap> {
  private protocolRepository: ProtocolRepository;

  protected bindOnRequest(service: IRPCServiceMap, cb: (service: IRPCServiceMap, prop: string) => void): void {
    Object.entries(service).forEach(([name, value]) => {
      if (!value) {
        return;
      }

      cb(service, name);

      if (name.startsWith('on')) {
        this.connection.onNotification(name, (headers: Record<string, any>, buffer: PlatformBuffer) => {
          const argsArray = this.protocolRepository.deserializeRequest(name, buffer);

          try {
            this.proxyService[name](...argsArray);
          } catch (e) {
            this.logger.warn(`notification exec ${name} error`, e);
          }
        });
      } else {
        this.connection.onRequest(name, async (headers: Record<string, any>, buffer: PlatformBuffer) => {
          const argsArray = this.protocolRepository.deserializeRequest(name, buffer);

          let result: any;
          try {
            result = await this.proxyService[name](...argsArray);
          } catch (e) {
            this.logger.warn(`request exec ${name} error`, e);
            throw e;
          }

          return this.protocolRepository.serializeResult(name, result);
        });
      }
    });
  }

  setProtocolRepository(protocolRepository: ProtocolRepository) {
    this.protocolRepository = protocolRepository;
  }

  getInvokeProxy(): any {
    return new Proxy(this, {
      get: (target, p: string | symbol) => {
        const prop = p.toString();

        return (...args: any[]) =>
          this.connectionPromise.promise.then(async (connection) => {
            if (!this.protocolRepository.has(prop)) {
              throw new MethodProtocolNotFoundError(prop);
            }

            const argsBuffer = this.protocolRepository.serializeRequest(prop, args);
            if (prop.startsWith('on')) {
              connection.sendNotification(prop, argsBuffer);
            } else {
              const { result } = await connection.sendRequest(prop, argsBuffer);
              return this.protocolRepository.deserializeResult(prop, result);
            }
          });
      },
    });
  }
}

export class MethodProtocolNotFoundError extends Error {
  constructor(method: string) {
    super(`method ${method} not found`);
  }
}
