import { StaticResourceService, IStaticResourceProvider } from './static.definition';
import { URI } from '@ali/ide-core-browser';
import { Injectable } from '@ali/common-di';

@Injectable()
export class StaticResourceServiceImpl implements StaticResourceService {

  private providers = new Map<string, IStaticResourceProvider>();

  public registerStaticResourceProvider(provider: IStaticResourceProvider) {
    this.providers.set(provider.scheme, provider);
  }
  public resolveStaticResource(uri: URI): URI {
    if (!this.providers.has(uri.scheme)) {
      return uri;
    }
    const url = this.providers.get(uri.scheme)!.resolveStaticResource(uri);
    // vscode-url path的 = 会被转码，先手动跳过转码
    url.toString = url.toString.bind(url, true);
    return url;
  }

}
