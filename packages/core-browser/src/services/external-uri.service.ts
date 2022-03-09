import { Injectable, Autowired } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-common';

import { AppConfig } from '../react-providers';

export const IExternalUriService = Symbol('IExternalUriService');

export interface IExternalUriService {
  /**
   * 将一个本地(localhost)地址转为远端地址(window.location)
   * @param uri 需要转换的 URI
   */
  resolveExternalUri(uri: URI): URI;
}

export interface ILocation {
  address: string;
  port: number;
}

@Injectable()
export class ExternalUriService implements IExternalUriService {
  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  resolveExternalUri(uri: URI): URI {
    const localhost = this.extractLocalHost(uri);
    if (localhost) {
      return this.toRemoteUrl(uri, localhost);
    }
    return uri;
  }

  protected toRemoteUrl(uri: URI, localhost: ILocation): URI {
    const authority = this.toRemoteHost(localhost);
    return URI.from({
      // scheme 默认和当前 scheme 一致
      scheme: URI.parse(window.location.href).scheme,
      authority,
      path: uri.path.toString(),
      fragment: uri.fragment,
      query: uri.query,
    });
  }

  protected toRemoteHost(localhost: ILocation): string {
    // 默认使用 remoteHostname
    const hostname = this.appConfig.remoteHostname || window.location.hostname;
    return `${hostname}:${localhost.port}`;
  }

  /**
   * 解析本地地址
   */
  protected extractLocalHost(uri: URI): { address: string; port: number } | undefined {
    if (uri.scheme !== 'http' && uri.scheme !== 'https') {
      return undefined;
    }
    const localhostMatch = /^(localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)$/.exec(uri.authority);
    if (!localhostMatch) {
      return undefined;
    }
    return {
      address: localhostMatch[1],
      port: +localhostMatch[2],
    };
  }
}
