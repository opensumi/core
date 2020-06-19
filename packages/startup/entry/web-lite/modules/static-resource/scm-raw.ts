import { Domain, URI, AppConfig } from '@ali/ide-core-browser';
import { Autowired } from '@ali/common-di';
import { StaticResourceContribution, StaticResourceService } from '@ali/ide-static-resource/lib/browser/static.definition';
import { IWorkspaceService } from '@ali/ide-workspace';
import { Path } from '@ali/ide-core-common/src/path';

import { IMetaService } from '../../simple-module/meta-service';

const EXPRESS_SERVER_PATH = window.location.href;

// const contentType = ALLOW_MIME[path.extname(filePath).slice(1)];

@Domain(StaticResourceContribution)
export class SCMRawFileServiceContribution implements StaticResourceContribution {
  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(IMetaService)
  private readonly metaService: IMetaService;

  registerStaticResolver(service: StaticResourceService): void {
    service.registerStaticResourceProvider({
      scheme: 'file',
      resolveStaticResource: (uri: URI) => {
        // file 协议统一走 scm raw 服务
        // https://127.0.0.1:8080/asset-service/v3/project/$repo/repository/blobs/$ref
        // GET /api/v3/projects/{id}/repository/blobs/{sha}
        const assetsUri = new URI(this.appConfig.staticServicePath || EXPRESS_SERVER_PATH);
        const rootUri = new URI(this.workspaceService.workspace?.uri!);
        const relativePath = rootUri.relative(uri);
        return assetsUri
          .withPath(
            new Path('asset-service/v3/projects')
            .join(
              this.metaService.repo!,
              'repository/blobs',
              this.metaService.ref,
            ),
          )
          .withQuery(`filepath=${relativePath?.toString()}`);
      },
      roots: [this.appConfig.staticServicePath || EXPRESS_SERVER_PATH],
    });

    service.registerStaticResourceProvider({
      scheme: 'kt-ext',
      resolveStaticResource: (uri: URI) => {
        // file 协议统一走 scm raw 服务
        // kt-ext 协议统一走 scheme 头转换为 https
        return uri.withScheme('https');
      },
      roots: [this.appConfig.staticServicePath || EXPRESS_SERVER_PATH],
    });
  }
}
