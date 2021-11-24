import { Autowired } from '@opensumi/di';
import {
  Domain,
  URI,
  FsProviderContribution,
  AppConfig,
} from '@opensumi/ide-core-browser';
import { Path } from '@opensumi/ide-core-common/lib/path';
import { BrowserFsProvider, AbstractHttpFileService } from './browser-fs-provider';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { StaticResourceContribution, StaticResourceService } from '@opensumi/ide-static-resource/lib/browser/static.definition';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IMetaService } from '../../services/meta-service/base';

const EXPRESS_SERVER_PATH = window.location.href;

// file 文件资源 远程读取
@Domain(StaticResourceContribution, FsProviderContribution)
export class FileProviderContribution implements StaticResourceContribution, FsProviderContribution {

  @Autowired(AbstractHttpFileService)
  private httpImpl: AbstractHttpFileService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(IMetaService)
  private readonly metaService: IMetaService;

  registerProvider(registry: IFileServiceClient) {
    // 处理 file 协议的文件部分
    registry.registerProvider('file', new BrowserFsProvider(this.httpImpl, { rootFolder: this.appConfig.workspaceDir }));
  }

  registerStaticResolver(service: StaticResourceService): void {
    // 用来打开 raw 文件，如 jpg
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
  }
}
