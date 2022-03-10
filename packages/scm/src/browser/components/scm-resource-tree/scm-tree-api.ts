import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Disposable } from '@opensumi/ide-core-common';
import * as paths from '@opensumi/ide-core-common/lib/path';

import { ISCMResource, ISCMResourceGroup, SCMViewModelMode } from '../../../common';
import { ViewModelContext } from '../../scm-model';
import { isSCMResourceGroup } from '../../scm-util';

export interface ISCMTreeNodeDescription<T = ISCMResource | ISCMResourceGroup> {
  /**
   * 唯一 key，用来缓存
   */
  id: string;
  pathname?: string;
  name: string;
  children: ISCMTreeNodeDescription<T>[];
  resource: T;
  type: 'group' | 'folder' | 'file';
  /**
   * 目录压缩模式
   */
  isCompact?: boolean;
}

/**
 * children collector for `ISCMTreeNodeDescription`
 */
export function collectSCMResourceDesc(
  node: ISCMTreeNodeDescription<ISCMResource>,
  result: ISCMResource[],
): ISCMResource[] {
  if (node.type === 'file') {
    result.push(node.resource);
  }

  for (const child of node.children) {
    collectSCMResourceDesc(child, result);
  }

  return result;
}

@Injectable()
export class SCMTreeAPI extends Disposable {
  @Autowired(ViewModelContext)
  private readonly viewModel: ViewModelContext;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  private get providerId() {
    return this.viewModel.selectedRepo?.provider.id;
  }

  public init(mode: SCMViewModelMode = SCMViewModelMode.Tree): ISCMTreeNodeDescription[] {
    const list = this.viewModel.scmList;

    // 一级目录处理
    // 类似 Git 插件的 Changes/Staged Changes/Merged Changes
    return list
      .filter((r) => isSCMResourceGroup(r))
      .map((resource: ISCMResourceGroup) => ({
        id: this.providerId + '_' + resource.id,
        name: resource.id,
        children:
          mode === SCMViewModelMode.Tree ? this.pathToTree(resource.elements) : this.pathToList(resource.elements),
        resource,
        type: 'group',
      }));
  }

  private pathToList(elements: ISCMResource[]): ISCMTreeNodeDescription[] {
    return elements.map((element) => {
      const pathname = this._getPathDesc(element);
      return {
        id: `${this.providerId}_${element.resourceGroup.id}_${pathname}`,
        name: pathname,
        pathname,
        children: [],
        resource: element,
        type: 'file',
      };
    });
  }

  private get shouldCompactFolders() {
    return this.preferenceService.get<boolean>('scm.listView.compactFolders');
  }

  private pathToTree(elements: ISCMResource[]): ISCMTreeNodeDescription[] {
    // // https://stackoverflow.com/questions/54424774/how-to-convert-an-array-of-paths-into-tree-object
    const result: ISCMTreeNodeDescription[] = [];
    // helper 的对象
    const kResult = Symbol('result');
    const accumulator = this._initPlainCounterObject(kResult, result);

    elements.forEach((element) => {
      // 取 workspace 的相对路径
      const path = this._getPathDesc(element);
      // 初始的 accumulator 为 level
      path
        .split(paths.Path.separator)
        .filter(Boolean)
        .reduce((acc, cur, index, pathList) => {
          // 每次返回 path 对应的 desc 作为下一个 path 的 parent
          // 不存在 path 对应的 desc 则创建一个新的挂载到 acc 上
          if (!acc[cur]) {
            acc[cur] = this._initPlainCounterObject(kResult, []);
            const pathname = pathList.slice(0, index + 1).join(paths.Path.separator);
            const resource = {
              id: `${this.providerId}_${element.resourceGroup.id}_${pathname}`,
              name: cur,
              pathname,
              children: acc[cur][kResult],
              resource: element,
              // 将 children 为 [] 时判断为文件
              type: index === pathList.length - 1 ? 'file' : 'folder',
            } as ISCMTreeNodeDescription;

            acc[kResult].push(resource);
          }
          // 返回当前 path 对应的 desc 作为下一次遍历的 parent
          return acc[cur];
        }, accumulator);
    });
    if (this.shouldCompactFolders) {
      this.walkTreeToFold(result);
    }
    return result;
  }

  private _initPlainCounterObject<T = any>(key: symbol, value: T): Record<symbol, T> {
    // 创建一个没有原型的对象
    // 避免文件 path 中带有 constructor/toString 等对象原型方法的 key 导致出错
    const obj = Object.create(null);
    obj[key] = value;
    return obj;
  }

  private walkTreeToFold(children: ISCMTreeNodeDescription[]) {
    const stack = [...children];
    while (stack.length) {
      const item = stack.pop();
      if (item) {
        this.foldOnlyChild(item);
        stack.push(...item.children);
      }
    }
  }

  private foldOnlyChild(item: ISCMTreeNodeDescription) {
    // 只有一个 child 并且不为文件，文件对应的 item 的 children 为空
    while (item.children.length === 1 && item.children[0].children.length) {
      const child = item.children[0];
      // 将 name 拼接起来
      item.name = `${item.name}${paths.Path.separator}${child.name}`;
      // 剩下部分继承 child 的属性
      item.pathname = child.pathname;
      item.children = child.children;
      item.id = child.id;
      item.isCompact = true;
    }
  }

  private _getPathDesc(resource: ISCMResource) {
    return paths.relative(resource.resourceGroup.provider.rootUri!.path, resource.sourceUri.path);
  }
}
