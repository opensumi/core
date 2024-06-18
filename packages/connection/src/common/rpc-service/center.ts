import {
  Deferred,
  DisposableStore,
  IDisposable,
  IReporterService,
  IReporterTimer,
  REPORT_NAME,
  randomString,
} from '@opensumi/ide-core-common';
import { addElement } from '@opensumi/ide-utils/lib/arrays';

import { METHOD_NOT_REGISTERED } from '../constants';
import { TSumiProtocol } from '../rpc';
import { SumiConnection } from '../rpc/connection';
import { IBench, ILogger, RPCServiceMethod, ServiceType } from '../types';

import { ProxyJson, ProxySumi } from './proxy';
import { ProxyBase } from './proxy/base';
import { ProtocolRegistry, ServiceRegistry } from './registry';

import type { MessageConnection } from '@opensumi/vscode-jsonrpc';

const kDefaultMinimumReportThresholdTime = 200;

export class RPCServiceCenter implements IDisposable {
  private _disposables = new DisposableStore();

  public uid: string;

  private proxies: ProxyBase<any>[] = [];

  private serviceRegistry = this._disposables.add(new ServiceRegistry());
  private protocolRegistry = this._disposables.add(new ProtocolRegistry());

  private deferred = new Deferred<void>();
  private logger: ILogger;

  constructor(private bench?: IBench, logger?: ILogger) {
    this.uid = randomString(6);
    this.logger = logger || console;
  }

  private _reporterService: IReporterService | undefined;
  private _reportThreshold: number = kDefaultMinimumReportThresholdTime;
  setReporter(
    reporterService: IReporterService,
    minimumReportThresholdTime: number = kDefaultMinimumReportThresholdTime,
  ) {
    this._reporterService = reporterService;
    this._reportThreshold = minimumReportThresholdTime;
  }

  registerService(serviceName: string, type: ServiceType): void {
    if (type === ServiceType.Service) {
      if (this.bench) {
        this.bench.registerService(serviceName);
      }
    }
  }

  ready() {
    return this.deferred.promise;
  }

  loadProtocol(protocol: TSumiProtocol) {
    this.protocolRegistry.addProtocol(protocol, {
      nameConverter: (name) => getMethodName(protocol.name, name),
    });
  }

  setSumiConnection(connection: SumiConnection) {
    if (this.proxies.length === 0) {
      this.deferred.resolve();
    }

    this.protocolRegistry.applyTo(connection.io);

    const proxy = new ProxySumi(this.serviceRegistry, this.logger);
    proxy.listen(connection);

    const remove = addElement(this.proxies, proxy);

    return {
      dispose: () => {
        remove.dispose();
        proxy.dispose();
      },
    };
  }

  setConnection(connection: MessageConnection) {
    if (this.proxies.length === 0) {
      this.deferred.resolve();
    }

    const proxy = new ProxyJson(this.serviceRegistry, this.logger);
    proxy.listen(connection);

    const remove = addElement(this.proxies, proxy);

    return {
      dispose: () => {
        remove.dispose();
        proxy.dispose();
      },
    };
  }

  onRequest(serviceName: string, _name: string, method: RPCServiceMethod) {
    this.serviceRegistry.register(getMethodName(serviceName, _name), method);
  }

  onRequestService(serviceName: string, service: any) {
    this.serviceRegistry.registerService(service, {
      nameConverter: (name) => getMethodName(serviceName, name),
    });
  }

  async broadcast(serviceName: string, _name: string, ...args: any[]): Promise<any> {
    await this.ready();
    const name = getMethodName(serviceName, _name);

    let timer: IReporterTimer | undefined;
    if (this._reporterService) {
      timer = this._reporterService.time(REPORT_NAME.RPC_TIMMING_MEASURE);
    }

    const broadcastResult = await Promise.all(this.proxies.map((proxy) => proxy.invoke(name, ...args)));

    const doubtfulResult = [] as any[];
    const result = [] as any[];
    for (const i of broadcastResult) {
      if (i === METHOD_NOT_REGISTERED) {
        doubtfulResult.push(i);
      } else {
        result.push(i);
      }
    }

    if (doubtfulResult.length > 0) {
      this.logger.warn(`broadcast rpc \`${name}\` getting doubtful responses: ${doubtfulResult.join(',')}`);
    }

    if (result.length === 0) {
      if (timer) {
        timer.timeEnd(
          name,
          {
            success: false,
          },
          {
            minimumReportThresholdTime: this._reportThreshold,
          },
        );
      }

      throw new Error(`broadcast rpc \`${name}\` error: no remote service can handle this call`);
    }

    if (timer) {
      timer.timeEnd(
        name,
        {
          success: true,
        },
        {
          minimumReportThresholdTime: this._reportThreshold,
        },
      );
    }

    // FIXME: this is an unreasonable design, if remote service only returned doubtful result, we will return an empty array.
    // but actually we should throw an error to tell user that no remote service can handle this call.
    // or just return `undefined`.
    return result.length === 1 ? result[0] : result;
  }

  dispose(): void {
    this._disposables.dispose();
    this.proxies.forEach((proxy) => proxy.dispose());
    this.proxies = [];
  }
}

export function getNotificationName(serviceName: string, name: string) {
  return `on:${serviceName}:${name}`;
}
export function getRequestName(serviceName: string, name: string) {
  return `${serviceName}:${name}`;
}

export function getMethodName(serviceName: string, name: string) {
  return name.startsWith('on') ? getNotificationName(serviceName, name) : getRequestName(serviceName, name);
}
