import { Domain, URI } from '@ali/ide-core-browser';
import { Injectable } from '@ali/common-di';
import { StaticResourceContribution, StaticResourceService } from '@ali/ide-static-resource/lib/browser/static.definition';
import { EXPRESS_SERVER_PATH } from '../common';

@Injectable()
@Domain(StaticResourceContribution)
export class ExpressFileServerContribution implements StaticResourceContribution {

  registerStaticResolver(service: StaticResourceService): void {
    const root = URI.file(process.env.WORKSPACE_DIR!);
    service.registerStaticResourceProvider({
      scheme: 'file',
      resolveStaticResource: async (uri: URI) => {
        const relative = root.relative(uri);
        return new URI(EXPRESS_SERVER_PATH + relative);
      },
    });
  }

}
