import { Autowired, Injectable } from '@ali/common-di';
import {
  Domain,
  ResourceResolverContribution,
  URI,
  Uri,
  FsProviderContribution,
  AppConfig,
} from '@ali/ide-core-browser';
import { Path } from '@ali/ide-core-common/lib/path';
import { FileResource } from '@ali/ide-file-service/lib/browser/file-service-contribution';
import { BrowserFsProvider, HttpFileServiceBase } from '@ali/ide-file-service/lib/browser/browser-fs-provider';
import { IFileServiceClient } from '@ali/ide-file-service';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { ClientAppContribution } from '@ali/ide-core-browser';

import { IMetaService } from './meta-service';
import { KaitianExtFsProvider } from './fs-provider/ktext-fs';

@Injectable()
class AoneCodeHttpFileService extends HttpFileServiceBase {
  @Autowired(IMetaService)
  metaService: IMetaService;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  static base64ToUnicode(str: string) {
    return decodeURIComponent(
      atob(str)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''),
    );
  }

  async readFile(uri: Uri, encoding?: string): Promise<string> {
    const _uri = new URI(uri);
    const content = await fetch(
      this.getResolveService(_uri),
      {
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    )
      .then((res) => res.json())
      .then((ret) => {
        if (ret.encoding === 'base64') {
          ret.content = AoneCodeHttpFileService.base64ToUnicode(ret.content);
        }
        return ret.content as string;
      });
    return content;
  }

  async readDir(uri: Uri) {
    const _uri = new URI(uri);
    const relativePath = URI.file(this.appConfig.workspaceDir).relative(_uri)!.toString();
    const children = await fetch(
      `/code-service/projects/${this.metaService.projectId}/repository/tree?ref_name=${this.metaService.ref}&type=direct${relativePath ? `&path=${relativePath}` : ''}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    ).then((res) => res.json());
    return children;
  }

  async updateFile(uri: Uri, content: string, options: { encoding?: string; newUri?: Uri; }): Promise<void> {
    const _uri = new URI(uri);
    const params: any = {
      branch_name: this.metaService.ref,
      commit_message: 'auto update file with DEF WebIDE',
      content,
      ...options,
    };
    let requestUri = this.getResolveService(_uri, 3);
    if (params.newUri) {
      requestUri = this.getResolveService(_uri, 4);
      params.old_path = this.getRelativePath(_uri, false),
      params.new_path = this.getRelativePath(new URI(params.newUri), false);
      delete params.newUri;
    } else {
      params.file_path = this.getRelativePath(_uri, false);
    }
    await fetch(
      requestUri,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'PUT',
        body: JSON.stringify(params),
      },
    )
    .then((res) => res.json())
    .then((ret) => {
      if (ret.status === false) {
        throw new Error(ret.message);
      }
    });
  }

  async createFile(uri: Uri, content: string, options: { encoding?: string; }) {
    const _uri = new URI(uri);
    const params: any = {
      branch_name: this.metaService.ref,
      commit_message: 'auto create file with DEF WebIDE',
      file_path: this.getRelativePath(_uri, false),
      content,
      ...options,
    };
    await fetch(
      this.getResolveService(_uri),
      {
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(params),
      },
    )
    .then((res) => res.json())
    .then((ret) => {
      if (ret.status === false) {
        throw new Error(ret.message);
      }
    });
  }

  async deleteFile(uri: Uri, options: { recursive: boolean, moveToTrash?: boolean }) {
    const _uri = new URI(uri);
    await fetch(
      this.getResolveService(_uri) + `&commit_message=${encodeURIComponent('auto delete file with DEF WebIDE')}&branch_name=${this.metaService.ref}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'DELETE',
      },
    )
    .then((res) => res.json())
    .then((ret) => {
      if (ret.status === false) {
        throw new Error(ret.message);
      }
    });
  }

  protected getRelativePath(uri: URI, encoding = true) {
    const path = new Path(`/${this.metaService.repo}`).relative(uri.path)!.toString();
    return encoding ? encodeURIComponent(path) : path;
  }

  // get restful http request url
  protected getResolveService: (uri: URI, version?: number) => string = (uri: URI, version = 3) => {
    const filename = this.getRelativePath(uri);
    return `/code-service/v${version}/projects/${this.metaService.projectId}/repository/files?file_path=${filename}&ref=${this.metaService.ref}`;
  }

}

// file 文件资源 远程读取
@Domain(ResourceResolverContribution, FsProviderContribution)
export class FSProviderContribution implements ResourceResolverContribution, FsProviderContribution {

  @Autowired(IFileServiceClient)
  private readonly fileSystem: FileServiceClient;

  @Autowired(AoneCodeHttpFileService)
  private httpImpl: AoneCodeHttpFileService;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  async resolve(uri: URI): Promise<FileResource | void> {
    if (uri.scheme !== 'file') {
      return ;
    }
    const resource = new FileResource(uri, this.fileSystem);
    await resource.init();
    return resource;
  }

  registerProvider(registry: IFileServiceClient) {
    registry.registerProvider('file', new BrowserFsProvider(this.httpImpl, {rootFolder: this.appConfig.workspaceDir}));
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
