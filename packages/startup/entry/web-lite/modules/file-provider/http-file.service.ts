import { Autowired, Injectable } from '@opensumi/di';
import { URI, Uri, AppConfig } from '@opensumi/ide-core-browser';
import { Path } from '@opensumi/ide-core-common/lib/path';
import { AbstractHttpFileService } from './browser-fs-provider';

import { IMetaService } from '../../services/meta-service/base';
import { base64ToUnicode } from '../../utils';

@Injectable()
export class AoneCodeHttpFileService extends AbstractHttpFileService {
  @Autowired(IMetaService)
  private readonly metaService: IMetaService;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

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
          ret.content = base64ToUnicode(ret.content);
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
    const path = new Path(`/${this.metaService.ref}/${this.metaService.repo}`).relative(uri.path)!.toString();
    return encoding ? encodeURIComponent(path) : path;
  }

  // get restful http request url
  protected getResolveService: (uri: URI, version?: number) => string = (uri: URI, version = 3) => {
    const filename = this.getRelativePath(uri);
    return `/code-service/v${version}/projects/${this.metaService.projectId}/repository/files?file_path=${filename}&ref=${this.metaService.ref}`;
  }
}
