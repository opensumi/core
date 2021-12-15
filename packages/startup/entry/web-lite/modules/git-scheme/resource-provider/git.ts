import { IResourceProvider, IResource } from '@opensumi/ide-editor/lib/browser';
import { URI, localize } from '@opensumi/ide-core-common';
import { Injectable, Autowired } from '@opensumi/di';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { Path } from '@opensumi/ide-core-common/lib/path';

import { getMinimalDiffPath } from '../../../utils';
import { fromSCMUri } from '../../../utils/scm-uri';

@Injectable()
export class GitResourceProvider implements IResourceProvider {
  readonly scheme = 'git';

  @Autowired(LabelService)
  labelService: LabelService;

  provideResource(uri: URI) {
    return Promise.all([
      this.getFileStat(uri.toString()),
      this.labelService.getName(uri),
      this.labelService.getIcon(uri),
    ] as const).then(([stat, name, icon]) => {
      let fileName = stat ? name : name + localize('file.resource-deleted', '(已删除)');
      if (uri.scheme === 'git') {
        const { ref } = fromSCMUri(uri);
        fileName = `git:${name}${ref ? `@${ref}` : ''}`;
      }

      return {
        name: fileName,
        icon,
        uri,
        metadata: null,
      };
    });
  }

  provideResourceSubname(resource: IResource, groupResources: IResource[]): string | null {
    const shouldDiff: URI[] = [];
    for (const res of groupResources) {
      if (res.uri.scheme === this.scheme && res.uri.displayName === resource.uri.displayName && res !== resource) {
        // 存在同协议的相同名称的文件
        shouldDiff.push(res.uri);
      }
    }
    if (shouldDiff.length > 0) {
      return '...' + Path.separator + getMinimalDiffPath(resource.uri, shouldDiff);
    } else {
      return null;
    }
  }

  // 除了doc dirty之外的逻辑基本上是通用的
  async shouldCloseResource(resource: IResource, openedResources: IResource[][]): Promise<boolean> {
    return true;
  }

  private getFileStat(uri: string) {
    return true;
  }
}
