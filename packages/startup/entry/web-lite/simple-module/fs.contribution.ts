import { Autowired } from '@ali/common-di';
import {
  Domain,
  ResourceResolverContribution,
  URI,
} from '@ali/ide-core-browser';
import { Path } from '@ali/ide-core-common/lib/path';
import { FileResource } from '@ali/ide-file-service/lib/browser/file-service-contribution';
import { BrowserFsProvider } from '@ali/ide-file-service/lib/browser/browser-fs-provider';
import { IFileServiceClient } from '@ali/ide-file-service';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { ClientAppContribution } from '@ali/ide-core-browser';

import { IMetaService } from './meta-service';
import { KaitianExtFsProvider } from './fs-provider/ktext-fs';

// file 文件资源 远程读取
@Domain(ResourceResolverContribution)
export class FSProviderContribution implements ResourceResolverContribution {

  @Autowired(IFileServiceClient)
  private readonly fileSystem: FileServiceClient;

  @Autowired(IMetaService)
  private readonly metaService: IMetaService;

  constructor() {
    this.fileSystem.registerProvider('file', new BrowserFsProvider((uri: URI) => {
      const filename = new Path(`/${this.metaService.repo}`).relative(uri.path)!.toString();
      return `/code-service/v3/projects/${this.metaService.projectId}/repository/files?file_path=${encodeURIComponent(filename)}&ref=${this.metaService.ref}`;
    }));
  }

  async resolve(uri: URI): Promise<FileResource | void> {
    if (uri.scheme !== 'file') {
      return ;
    }
    const resource = new FileResource(uri, this.fileSystem);
    await resource.init();
    return resource;
  }

}

@Domain(ClientAppContribution)
export class KtExtFsProviderContribution implements ClientAppContribution {

  @Autowired(IFileServiceClient)
  private readonly fileSystem: FileServiceClient;

  initialize() {
    this.fileSystem.registerProvider('kt-ext', new KaitianExtFsProvider());
  }
}
