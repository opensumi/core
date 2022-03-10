import { Injectable, Autowired } from '@opensumi/di';
import { Tree, ITreeNodeOrCompositeTreeNode, TreeNodeType } from '@opensumi/ide-components';
import { URI, formatLocalize, Emitter, Event } from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { Path } from '@opensumi/ide-core-common/lib/path';
import { WorkbenchEditorService, IEditorGroup, IResource, ResourceService } from '@opensumi/ide-editor';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { EditorFileGroup, EditorFile, EditorFileRoot, OpenedEditorData } from '../opened-editor-node.define';

@Injectable()
export class OpenedEditorService extends Tree {
  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(LabelService)
  public readonly labelService: LabelService;

  @Autowired(ResourceService)
  private readonly resourceService: ResourceService;

  private cacheEditorNode: Map<string, EditorFileGroup | EditorFile | EditorFileRoot> = new Map();
  // 是否为分组的节点树
  private isGroupTree = false;

  private onDirtyNodesChangeEmitter: Emitter<EditorFile[]> = new Emitter();

  get onDirtyNodesChange(): Event<EditorFile[]> {
    return this.onDirtyNodesChangeEmitter.event;
  }

  async resolveChildren(
    parent?: EditorFileRoot | EditorFileGroup,
  ): Promise<(EditorFileGroup | EditorFileRoot | EditorFile)[]> {
    let children: (EditorFileGroup | EditorFileRoot | EditorFile)[] = [];
    if (!parent) {
      this._root = new EditorFileRoot(this);
      children = [this._root as EditorFileRoot];
    } else if (EditorFileRoot.is(parent)) {
      // 重制isGroupTree状态
      this.isGroupTree = false;
      let groupOrResource: OpenedEditorData[] = [];
      if (this.workbenchEditorService.editorGroups.length <= 1) {
        groupOrResource = this.workbenchEditorService.editorGroups[0].resources.slice();
      } else {
        groupOrResource = this.workbenchEditorService.editorGroups;
      }
      for (const item of groupOrResource) {
        if (!(item as IEditorGroup).resources) {
          const cacheNode = this.getEditorNodeByUri(item as IResource, (parent as EditorFileGroup).group);
          const tooltip = await this.getReadableTooltip((item as IResource).uri);
          children.push(
            new EditorFile(this, item as IResource, tooltip, parent as EditorFileGroup, cacheNode && cacheNode.id),
          );
        } else {
          this.isGroupTree = true;
          const cacheNode = this.getEditorNodeByUri(undefined, item as IEditorGroup);
          const groupItem = new EditorFileGroup(this, item as IEditorGroup, parent, cacheNode && cacheNode.id);
          children.push(groupItem);
        }
      }
    } else {
      for (const resource of (parent as EditorFileGroup).group.resources) {
        const cacheNode = this.getEditorNodeByUri(resource as IResource, (parent as EditorFileGroup).group);
        const tooltip = await this.getReadableTooltip(resource.uri);
        children.push(new EditorFile(this, resource, tooltip, parent, cacheNode && cacheNode.id));
      }
    }
    this.cacheNodes(children);
    return children;
  }

  sortComparator = (a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) => {
    if (a.constructor === b.constructor) {
      if ((a as EditorFile).resource && (b as EditorFile).resource) {
        const parent = (a as EditorFile).parent as EditorFileGroup;
        if (parent.group) {
          return (
            parent.group.resources.indexOf((a as EditorFile).resource) -
            parent.group.resources.indexOf((b as EditorFile).resource)
          );
        } else {
          const currentGroup = this.workbenchEditorService.currentEditorGroup;
          if (currentGroup && currentGroup.resources) {
            return (
              currentGroup.resources.indexOf((a as EditorFile).resource) -
              currentGroup.resources.indexOf((b as EditorFile).resource)
            );
          }
        }
      }
      // numeric 参数确保数字为第一排序优先级
      return a.name.localeCompare(b.name, 'kn', { numeric: true }) as any;
    }
    return a.type === TreeNodeType.CompositeTreeNode ? -1 : b.type === TreeNodeType.CompositeTreeNode ? 1 : 0;
  };

  private cacheNodes(nodes: (EditorFileGroup | EditorFileRoot | EditorFile)[]) {
    const dirtyNodes: EditorFile[] = [];
    for (const node of nodes) {
      if ((node as EditorFile).uri) {
        const decoration = this.resourceService.getResourceDecoration((node as EditorFile).uri);
        if (decoration.dirty) {
          dirtyNodes.push(node as EditorFile);
        }
        // EditorFile
        const parent = node.parent;
        this.cacheEditorNode.set(new Path(parent?.path!).join((node as EditorFile).uri.toString()).toString(), node);
      } else if (EditorFileGroup.is(node as any)) {
        // EditorFileGroup
        this.cacheEditorNode.set(node.path, node);
      } else {
        // EditorFileRoot
        this.cacheEditorNode.set(node.path, node);
      }
    }
    if (dirtyNodes.length > 0) {
      this.onDirtyNodesChangeEmitter.fire(dirtyNodes);
    }
  }

  public getEditorNodeByUri(resource?: IResource | URI, group?: IEditorGroup) {
    let path = this.root!.path;
    if (resource) {
      if (this.isGroupTree) {
        if (!group) {
          return;
        }
        const groupName = formatLocalize('opened.editors.group.title', group.index + 1);
        path = new Path(path)
          .join(groupName)
          .join(
            resource && (resource as IResource).uri
              ? (resource as IResource).uri.toString()
              : (resource as URI).toString(),
          )
          .toString();
      } else {
        path = new Path(path)
          .join(
            resource && (resource as IResource).uri
              ? (resource as IResource).uri.toString()
              : (resource as URI).toString(),
          )
          .toString();
      }
      return this.cacheEditorNode.get(path);
    } else {
      if (!group) {
        return;
      }
      const groupName = formatLocalize('opened.editors.group.title', group.index + 1);
      path = new Path(path).join(groupName).toString();
      return this.cacheEditorNode.get(path);
    }
  }

  /**
   * 获取相对路径的Tooltip
   * 无法获取相对路径，则完整显示uri路径
   * @param {URI} path
   * @returns
   * @memberof FileTreeAPI
   */
  public async getReadableTooltip(path: URI) {
    if (path.scheme !== 'file') {
      return '';
    }
    const roots = await this.workspaceService.roots;
    for (const root of roots) {
      const rootUri = new URI(root.uri);
      if (rootUri.isEqualOrParent(path)) {
        return decodeURIComponent(rootUri.relative(path)?.toString()!);
      }
    }
    return path.toString();
  }
}
