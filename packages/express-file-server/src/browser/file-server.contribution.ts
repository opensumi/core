import { Domain, URI, AppConfig } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';
import { StaticResourceContribution, StaticResourceService } from '@ali/ide-static-resource/lib/browser/static.definition';
import { EXPRESS_SERVER_PATH } from '../common';

@Injectable()
@Domain(StaticResourceContribution)
export class ExpressFileServerContribution implements StaticResourceContribution {

  @Autowired(AppConfig)
  appConfig: AppConfig;

  registerStaticResolver(service: StaticResourceService): void {
    const root = URI.file(this.appConfig.workspaceDir);
    service.registerStaticResourceProvider({
      scheme: 'file',
      resolveStaticResource: async (uri: URI) => {
        const relative = root.relative(uri);
        return new URI(EXPRESS_SERVER_PATH + relative);
      },
    });
  }

}
