import { Domain, URI, AppConfig } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';
import { StaticResourceContribution, StaticResourceService } from '@ali/ide-static-resource/lib/browser/static.definition';
import { EXPRESS_SERVER_PATH } from '../common';

@Domain(StaticResourceContribution)
export class ExpressFileServerContribution implements StaticResourceContribution {

  @Autowired(AppConfig)
  appConfig: AppConfig;

  registerStaticResolver(service: StaticResourceService): void {
    const root = URI.file(this.appConfig.workspaceDir);
    const extRoot = URI.file(this.appConfig.coreExtensionDir!);
    service.registerStaticResourceProvider({
      scheme: 'file',
      resolveStaticResource: async (uri: URI) => {
        let relative: string | undefined;
        if (root.isEqualOrParent(uri)) {
          relative = root.relative(uri)!.toString();
        } else {
          relative = extRoot.relative(uri)!.toString();
        }
        if (relative) {
          return new URI(EXPRESS_SERVER_PATH + relative);
        } else {
          return uri;
        }
      },
    });
  }

}
