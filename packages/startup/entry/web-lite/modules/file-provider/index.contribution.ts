import { Autowired } from '@ali/common-di';
import {
  Domain,
  ResourceResolverContribution,
  URI,
  FsProviderContribution,
  AppConfig,
} from '@ali/ide-core-browser';
import { Path } from '@ali/ide-core-common/lib/path';
import { FileResource } from '@ali/ide-file-service/lib/browser/file-service-contribution';
import { BrowserFsProvider, HttpFileServiceBase } from '@ali/ide-file-service/lib/browser/browser-fs-provider';
import { IFileServiceClient } from '@ali/ide-file-service';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { StaticResourceContribution, StaticResourceService } from '@ali/ide-static-resource/lib/browser/static.definition';
import { IWorkspaceService } from '@ali/ide-workspace';

import { IMetaService } from '../../services/meta-service/base';

const EXPRESS_SERVER_PATH = window.location.href;

// file 文件资源 远程读取
@Domain(ResourceResolverContribution, StaticResourceContribution, FsProviderContribution)
export class FileProviderContribution implements ResourceResolverContribution, StaticResourceContribution, FsProviderContribution {

  @Autowired(IFileServiceClient)
  private readonly fileSystem: FileServiceClient;

  @Autowired(HttpFileServiceBase)
  private httpImpl: HttpFileServiceBase;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(IMetaService)
  private readonly metaService: IMetaService;

  async resolve(uri: URI): Promise<FileResource | void> {
    if (uri.scheme !== 'file') {
      return ;
    }
    const resource = new FileResource(uri, this.fileSystem);
    await resource.init();
    return resource;
  }

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
