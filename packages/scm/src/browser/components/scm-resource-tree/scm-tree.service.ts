import { Autowired, Injectable } from '@opensumi/di';
import { Tree, ITreeNodeOrCompositeTreeNode } from '@opensumi/ide-components';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Emitter, Event, PreferenceScope } from '@opensumi/ide-core-common';

import { ISCMResource, ISCMResourceGroup, SCMViewModelMode } from '../../../common';

import { SCMTreeAPI, ISCMTreeNodeDescription } from './scm-tree-api';
import {
  SCMResourceRoot,
  SCMResourceGroup,
  SCMResourceFile,
  SCMResourceFolder,
  SCMResourceNotRoot,
  SCMResourceNotFile,
  SCMResourceItem,
} from './scm-tree-node';

/**
 * 应为单例
 */
@Injectable()
export class SCMTreeService extends Tree {
  @Autowired(SCMTreeAPI)
  private readonly scmTreeAPI: SCMTreeAPI;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  /**
   * 默认为 `List` 模式
   */
  private _isTreeMode: boolean;

  public get isTreeMode() {
    return this._isTreeMode;
  }

  private readonly onDidTreeModeChangeEmitter: Emitter<boolean> = new Emitter();
  public get onDidTreeModeChange(): Event<boolean> {
    return this.onDidTreeModeChangeEmitter.event;
  }

  // cache related starts
  private cachedTreeNodeMap: Map<string, SCMResourceNotRoot> = new Map();
  private cachedListNodeMap: Map<string, SCMResourceNotRoot> = new Map();

  public getCachedNodeItem(uid: string) {
    return this.isTreeMode ? this.cachedTreeNodeMap.get(uid) : this.cachedListNodeMap.get(uid);
  }

  // tslint:disable-next-line:no-unused-variable
  private clearCachedNodeItem() {
    this.cachedListNodeMap.clear();
    this.cachedTreeNodeMap.clear();
  }

  private cacheNodeItem(uriStr: string, node: SCMResourceNotRoot) {
    return this.isTreeMode ? this.cachedTreeNodeMap.set(uriStr, node) : this.cachedListNodeMap.set(uriStr, node);
  }
  // cache related ends

  constructor() {
    super();
    this._isTreeMode = this.preferenceService.get<SCMViewModelMode>('scm.defaultViewMode') === SCMViewModelMode.Tree;
    this.toDispose.push(
      this.preferenceService.onSpecificPreferenceChange('scm.defaultViewMode', (changed) => {
        const nextValue = changed.newValue === SCMViewModelMode.Tree;
        if (nextValue !== this._isTreeMode) {
          this._isTreeMode = nextValue;
          this.onDidTreeModeChangeEmitter.fire(this._isTreeMode);
        }
      }),
    );
  }

  /**
   *  中间的状态值由SCMTreeService处理，让 SCMTreeAPI 功能更简单
   */
  public changeTreeMode(bool: boolean) {
    this.preferenceService.set(
      'scm.defaultViewMode',
      bool ? SCMViewModelMode.Tree : SCMViewModelMode.List,
      PreferenceScope.User,
    );
  }

  public async resolveChildren(parent?: SCMResourceNotFile): Promise<SCMResourceItem[]> {
    let children: SCMResourceItem[] = [];

    if (!parent) {
      // 创建 root 节点
      // 目前的设计是默认都是 tree 结构
      // Tree/List 的差异只是对于每层 changes 的本身是否需要拍平/转 tree
      this._root = new SCMResourceRoot(this, this._isTreeMode);
      children = [this._root as SCMResourceRoot];
    } else if (SCMResourceRoot.is(parent)) {
      const initData = this.scmTreeAPI.init(this._isTreeMode ? SCMViewModelMode.Tree : SCMViewModelMode.List);
      // 这里针对 children 做一个排序
      children.push(
        ...initData.map((child) => {
          const node = this.toNode(child, parent, this._isTreeMode);
          return node;
        }),
      );
      this.cacheNodes(children as SCMResourceNotRoot[]);
    } else {
      if (parent.raw) {
        // 这里针对 children 做一个排序
        const childList = parent.raw.children as unknown as ISCMTreeNodeDescription[];
        children.push(
          ...childList.map((child) => {
            const node = this.toNode(child, parent, this._isTreeMode);
            return node;
          }),
        );
        this.cacheNodes(children as SCMResourceNotRoot[]);
      }
    }
    return children;
  }

  private cacheNodes(nodes: SCMResourceNotRoot[]) {
    nodes.forEach((node) => {
      // 利用唯一 Key 进行缓存
      this.cacheNodeItem(node.raw.id, node);
    });
  }

  private toNode(child: ISCMTreeNodeDescription, parent: SCMResourceNotFile, isTree: boolean) {
    if (child.type === 'group') {
      const c = child as ISCMTreeNodeDescription<ISCMResourceGroup>;
      return new SCMResourceGroup(this, parent, c, c.resource, this.getCachedNodeItem(c.id)?.id);
    }

    const c = child as ISCMTreeNodeDescription<ISCMResource>;
    if (child.type === 'file') {
      return new SCMResourceFile(this, parent, c, c.resource, isTree, this.getCachedNodeItem(c.id)?.id);
    } else {
      return new SCMResourceFolder(this, parent, c, c.resource, this.getCachedNodeItem(c.id)?.id);
    }
  }

  sortComparator(a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) {
    // 由于 tree 的 resolve 是无序的, 将 SCMResourceGroup 按照 id 排序
    if (SCMResourceGroup.is(a) && SCMResourceGroup.is(b)) {
      // 数字越大优先级越高
      const priority = {
        merge: 3,
        index: 2,
        workingTree: 1,
      };
      return priority[(b.resource as ISCMResourceGroup).id] - priority[(a.resource as ISCMResourceGroup).id];
    }

    return super.sortComparator(a, b);
  }

  /**
   * 默认的 scm list 的结构是拍平的
   * 但是有个特征是
   * [
   *  mergedChangesGroup, ...mergedChangesGroupResources, (当子元素为空时则不存在(git 插件内部逻辑))
   *  stagedChangesGroup, ...stagedChangesGroupResources, (当子元素为空时则不存在(git 插件内部逻辑))
   *  changesGroup, ...changesGroupResources,
   * ]
   */
}
