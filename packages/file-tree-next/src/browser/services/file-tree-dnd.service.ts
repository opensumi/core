import { Injectable, Autowired, Optional } from '@ali/common-di';
import { FileTreeModelService } from './file-tree-model.service';
import { Directory, File } from '../file-tree-nodes';
import { DisposableCollection, Disposable, ILogger } from '@ali/ide-core-browser';
import { IFileTreeAPI } from '../../common';
import { IMessageService } from '@ali/ide-overlay';
import { Decoration, TargetMatchMode } from '@ali/ide-components';
import { Path } from '@ali/ide-core-common/lib/path';
import { FileTreeService } from '../file-tree.service';
import * as styles from '../file-tree.module.less';
import * as treeNodeStyles from '../file-tree-node.module.less';

@Injectable()
export class DragAndDropService {

  static MS_TILL_DRAGGED_OVER_EXPANDS: number = 500;

  @Autowired(IFileTreeAPI)
  private readonly fileTreeAPI: IFileTreeAPI;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  @Autowired(FileTreeService)
  private readonly fileTreeService: FileTreeService;

  private toCancelNodeExpansion: DisposableCollection = new DisposableCollection();

  private beingDraggedDec: Decoration = new Decoration(treeNodeStyles.mod_dragging);
  private draggedOverDec: Decoration = new Decoration(treeNodeStyles.mod_dragover);

  // 上一次拖拽进入的目录
  private potentialParent: Directory | null;
  // 开始拖拽的节点
  private beingDraggedNodes: (File | Directory)[] = [];
  // 拖拽进入的节点
  private draggedOverNode: Directory | File;

  constructor(@Optional() private readonly model: FileTreeModelService) {
    this.model.decorations.addDecoration(this.beingDraggedDec);
    this.model.decorations.addDecoration(this.draggedOverDec);
  }

  get root() {
    return this.model.treeModel.root;
  }

  setDraggableTreeNodeAsData(data: DataTransfer, nodes: (File | Directory)[]) {
    if (nodes.length > 0) {
      data.setData('uri', nodes[0].uri.toString());
    }
  }

  handleDragStart = (ev: React.DragEvent, node: File | Directory) => {
    ev.stopPropagation();
    // React中的DragEnd事件可能不会触发，需要手动用Dom监听
    // issue https://stackoverflow.com/a/24543568
    ev.currentTarget.addEventListener('dragend', (ev) => {
      this.handleDragEnd(ev, node);
    }, false);
    let draggedNodes = this.model.selectedFiles;
    let isDragWithSelectedNode = false;
    for (const selected of draggedNodes) {
      if (selected && selected.id === node.id) {
        isDragWithSelectedNode = true;
      }
    }
    if (!isDragWithSelectedNode) {
      draggedNodes = [node];
    }

    this.setDraggableTreeNodeAsData(ev.dataTransfer, draggedNodes);

    this.beingDraggedNodes = draggedNodes;

    draggedNodes.forEach((node) => {
      // 添加拖拽样式
      this.beingDraggedDec.addTarget(node, TargetMatchMode.Self);
    });

    if (ev.dataTransfer) {
      let label: string;
      if (draggedNodes.length === 1) {
        label = typeof node.name === 'string' ? node.name : '';
      } else {
        label = String(draggedNodes.length);
      }
      const dragImage = document.createElement('div');
      dragImage.className = styles.file_tree_drag_image;
      dragImage.textContent = label;
      document.body.appendChild(dragImage);
      ev.dataTransfer.setDragImage(dragImage, -10, -10);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  }

  handleDragEnter = (ev: React.DragEvent, node: File | Directory) => {
    ev.preventDefault();
  }

  handleDragLeave = (ev: React.DragEvent, node: File | Directory) => {
    ev.preventDefault();
    ev.stopPropagation();
    this.toCancelNodeExpansion.dispose();
    // 拖拽目标离开时，清除选中态
    if (this.potentialParent) {
      this.draggedOverDec.removeTarget(this.potentialParent);
      // 通知视图更新
      this.model.treeModel.dispatchChange();
    }
  }

  handleDragOver = (ev: React.DragEvent, node: File | Directory) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (!this.toCancelNodeExpansion.disposed) {
      return;
    }
    if (this.beingDraggedNodes.indexOf(node) >= 0) {
      return;
    }

    this.draggedOverNode = node;

    const newPotentialParent: Directory = (Directory.is(node) && (node as Directory).expanded)
      ? node as Directory
      : node.parent as Directory;

    if (this.potentialParent !== newPotentialParent) {
      if (this.potentialParent) {
        this.draggedOverDec.removeTarget(this.potentialParent);
      }
      this.potentialParent = newPotentialParent;
      this.draggedOverDec.addTarget(this.potentialParent, TargetMatchMode.SelfAndChildren);
      // 通知视图更新
      this.model.treeModel.dispatchChange();
    }

    if (this.potentialParent !== node && Directory.is(node)) {
      const timer = setTimeout(async () => {
        if (!node.expanded) {
          await (node as Directory).setExpanded(true);
          // 确保当前仍在当前拖区域节点中
          if (this.draggedOverNode === node) {
            if (this.potentialParent) {
              this.draggedOverDec.removeTarget(this.potentialParent);
            }
            this.potentialParent = node as Directory;
            this.draggedOverDec.addTarget(this.potentialParent, TargetMatchMode.SelfAndChildren);
          }
        } else {
          if (this.potentialParent) {
            this.draggedOverDec.removeTarget(this.potentialParent);
          }
          this.potentialParent = node as Directory;
          this.draggedOverDec.addTarget(this.potentialParent, TargetMatchMode.SelfAndChildren);
        }
        // 通知视图更新
        this.model.treeModel.dispatchChange();
      }, DragAndDropService.MS_TILL_DRAGGED_OVER_EXPANDS);
      this.toCancelNodeExpansion.push(Disposable.create(() => clearTimeout(timer)));
    }
  }

  handleDrop = async (ev: React.DragEvent, node?: File | Directory) => {
    try {
      ev.preventDefault();
      ev.stopPropagation();
      // 移除染色
      ev.dataTransfer.dropEffect = 'copy';
      let containing: File | Directory;
      if (node) {
        containing = Directory.is(node) ? node as Directory : node.parent as Directory;
      } else {
        containing = this.root as Directory;
      }
      if (!!containing) {
        const resources = this.beingDraggedNodes;
        if (resources.length > 0) {
          const resourcesCanBeMoved = resources.filter((resource: File | Directory) => resource && resource.parent && !(resource.parent as Directory).uri.isEqual(containing.uri));
          if (resourcesCanBeMoved.length > 0) {
            // 最小化移动文件
            const errors = await this.fileTreeAPI.mvFiles(resourcesCanBeMoved.map((res) => res.uri), containing.uri);
            if (errors && errors.length > 0) {
              errors.forEach((error) => {
                this.messageService.error(error);
              });
            } else {
              for (const target of resourcesCanBeMoved) {
                const to = containing.uri.resolve(target.name);
                this.fileTreeService.moveNodeByPath(target.parent as Directory, target.path, new Path(containing.path).join(target.name).toString());
                // 由于节点移动时默认仅更新节点路径
                // 我们需要自己更新额外的参数，如uri, filestat等
                target.updateURI(to);
                target.updateFileStat({
                  ...target.filestat,
                  uri: to.toString(),
                });
                target.updateToolTip(this.fileTreeAPI.getReadableTooltip(to));
                // 当重命名文件为文件夹时，刷新文件夹更新子文件路径
                if (Directory.is(target)) {
                  this.fileTreeService.refresh(target as Directory);
                }
              }
            }
          }
        }
      }
      if (node) {
        this.beingDraggedDec.removeTarget(node);
      }
      if (this.potentialParent) {
        this.draggedOverDec.removeTarget(this.potentialParent);
      }
      this.beingDraggedNodes.forEach((node) => {
        // 添加拖拽样式
        this.beingDraggedDec.removeTarget(node);
      });
      this.beingDraggedNodes = [];
      this.potentialParent = null;
      // 通知视图更新
      this.model.treeModel.dispatchChange();
      if (!this.toCancelNodeExpansion.disposed) {
        this.toCancelNodeExpansion.dispose();
      }
    } catch (e) {
      this.logger.error(e);
    }
  }

  handleDragEnd = (ev: React.DragEvent, node: File | Directory) => {
    this.beingDraggedDec.removeTarget(node);
    if (this.potentialParent) {
      this.draggedOverDec.removeTarget(this.potentialParent);
    }
    this.beingDraggedNodes.forEach((node) => {
      // 移除拖拽样式
      this.beingDraggedDec.removeTarget(node);
    });
    this.beingDraggedNodes = [];
    this.potentialParent = null;
    // 通知视图更新
    this.model.treeModel.dispatchChange();
    if (!this.toCancelNodeExpansion.disposed) {
      this.toCancelNodeExpansion.dispose();
    }
  }
}
