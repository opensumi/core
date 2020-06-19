import { IResourceProvider, IResource } from '@ali/ide-editor/lib/browser';
import { URI, localize } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { Path } from '@ali/ide-core-common/lib/path';

/**
 * TODO file-scheme 内很多逻辑是通用的，和node fs关联的功能放在一个独立的模块内可移除比较合适
 * 找到source文件url和中从末尾开始和target不一样的path
 * @param source
 * @param targets
 */
function getMinimalDiffPath(source: URI, targets: URI[]): string {
  const sourceDirPartsReverse = source.path.dir.toString().split(Path.separator).reverse();
  const targetDirPartsReverses = targets.map((target) => {
    return target.path.dir.toString().split(Path.separator).reverse();
  });
  for (let i = 0; i < sourceDirPartsReverse.length; i ++ ) {
    let foundSame = false;
    for (const targetDirPartsReverse of targetDirPartsReverses) {
      if (targetDirPartsReverse[i] === sourceDirPartsReverse[i]) {
        foundSame = true;
        break;
      }
    }
    if (!foundSame) {
      return sourceDirPartsReverse.slice(0, i + 1).reverse().join(Path.separator);
    }
  }
  return sourceDirPartsReverse.reverse().join(Path.separator);
}

@Injectable()
export class AntcodeResourceProvider implements IResourceProvider {
  readonly scheme = 'antcode';

  @Autowired(LabelService)
  labelService: LabelService;

  provideResource(uri: URI) {
    return Promise.all([
      this.getFileStat(uri.toString()),
      this.labelService.getName(uri),
      this.labelService.getIcon(uri),
    ] as const).then(([stat, name, icon]) => {
      return {
        name: stat ? name : (name + localize('file.resource-deleted', '(已删除)')),
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

  // TODO 除了doc dirty之外的逻辑基本上是通用的
  async shouldCloseResource(resource: IResource, openedResources: IResource[][]): Promise<boolean> {
    return true;
  }

  // TODO browser fs
  private getFileStat(uri: string) {
    return true;
  }

}

@Injectable()
export class AoneResourceProvider implements IResourceProvider {
  readonly scheme = 'aonecode';

  @Autowired(LabelService)
  labelService: LabelService;

  provideResource(uri: URI) {
    return Promise.all([
      this.getFileStat(uri.toString()),
      this.labelService.getName(uri),
      this.labelService.getIcon(uri),
    ] as const).then(([stat, name, icon]) => {
      return {
        name: stat ? name : (name + localize('file.resource-deleted', '(已删除)')),
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

  // TODO 除了doc dirty之外的逻辑基本上是通用的
  async shouldCloseResource(resource: IResource, openedResources: IResource[][]): Promise<boolean> {
    return true;
  }

  // TODO browser fs
  private getFileStat(uri: string) {
    return true;
  }

}
