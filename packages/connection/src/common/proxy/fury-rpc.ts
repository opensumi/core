import { PlatformBuffer } from '@opensumi/ide-core-common/lib/connection/types';

import { BinaryConnection } from '../binary-connection';
import { IRPCServiceMap } from '../rpc-service-center';
import { RPCServiceProtocolRepository } from '../rpc-service-protocol-repository';

import { RPCProxyBase } from './base';

export class RPCProxyFury extends RPCProxyBase<BinaryConnection, IRPCServiceMap> {
  private protocolRepository: RPCServiceProtocolRepository;

  protected bindOnRequest(service: IRPCServiceMap, cb: (service: IRPCServiceMap, prop: string) => void): void {
    Object.entries(service).forEach(([name, value]) => {
      if (!value) {
        return;
      }

      cb(service, name);

      if (name.startsWith('on')) {
        this.connection.onNotification(name, (buffer: PlatformBuffer) => {
          const argsArray = this.protocolRepository.deserializeRequest(name, buffer);
          try {
            this.proxyService[name](...argsArray);
          } catch (e) {
            this.logger.warn('notification', e);
          }
        });
      } else {
        this.connection.onRequest(name, async (buffer: PlatformBuffer) => {
          const argsArray = this.protocolRepository.deserializeRequest(name, buffer);
          try {
            const result = await this.proxyService[name](...argsArray);
            return this.protocolRepository.serializeResult(name, result);
          } catch (e) {
            this.logger.warn('request', e);
            throw e;
          }
        });
      }
    });
  }

  setProtocolRepository(protocolRepository: RPCServiceProtocolRepository) {
    this.protocolRepository = protocolRepository;
  }

  getRPCInvokeProxy(): any {
    return new Proxy(this, {
      get: (target, p: string | symbol) => {
        const prop = p.toString();

        return (...args: any[]) =>
          this.connectionPromise.promise.then(async (connection) => {
            const argsBuffer = this.protocolRepository.serializeRequest(prop, args);
            if (prop.startsWith('on')) {
              connection.sendNotification(prop, argsBuffer);
            } else {
              const result = await connection.sendRequest(prop, argsBuffer);
              return this.protocolRepository.deserializeResult(prop, result);
            }
          });
      },
    });
  }
}
