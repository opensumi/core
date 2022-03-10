import { Autowired } from '@opensumi/di';
import { Domain, URI, AppConfig } from '@opensumi/ide-core-browser';
import {
  StaticResourceContribution,
  StaticResourceService,
} from '@opensumi/ide-static-resource/lib/browser/static.definition';

import { EXPRESS_SERVER_PATH } from '../common';

@Domain(StaticResourceContribution)
export class ExpressFileServerContribution implements StaticResourceContribution {
  @Autowired(AppConfig)
  appConfig: AppConfig;

  registerStaticResolver(service: StaticResourceService): void {
    service.registerStaticResourceProvider({
      scheme: 'file',
      resolveStaticResource: (uri: URI) => {
        // file 协议统一走静态服务
        // http://0.0.0.0:8000/assets/${path}
        const assetsUri = new URI(this.appConfig.staticServicePath || EXPRESS_SERVER_PATH);
        /**
         * uri.path 在 Windows 下会被解析为  \c:\\Path\\to\file
         * fsPath C:\\Path\\to\\file
         */
        return assetsUri.withPath(`assets${decodeURIComponent(uri.codeUri.fsPath)}`);
      },
      roots: [this.appConfig.staticServicePath || EXPRESS_SERVER_PATH],
    });
  }
}
