import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ViewState, useInjectable } from '@ali/ide-core-browser';
import * as styles from './file-tree.module.less';
import { RecycleTree, INodeRendererProps, TreeModel, NodeType, IRecycleTreeHandle } from '@ali/ide-components';
import { FileTreeNode, FILE_TREE_NODE_HEIGHT } from './file-tree-node';
import { FileTreeService } from './file-tree.service';
import { FileTreeModelService } from './services/file-tree-model.service';
import { Directory, File } from './file-tree-nodes';

export const FileTree = observer(({
  viewState,
}: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const [isReady, setIsReady] = React.useState<boolean>(false);
  const [treeHandle, setTreeHandler] = React.useState<IRecycleTreeHandle>();
  const { width, height } = viewState;
  const { decorationService, labelService } = useInjectable<FileTreeService>(FileTreeService);
  const fileTreeModelService = useInjectable<FileTreeModelService>(FileTreeModelService);

  const toggleDirectory = (item: Directory) => {
    if (treeHandle) {
      if (item.expanded) {
        treeHandle.collapseNode(item);
      } else {
        treeHandle.expandNode(item);
      }
    }
  };

  const handleItemClicked = (ev: React.MouseEvent, item: File | Directory, type: NodeType) => {
    // TODO: 使用装饰器逻辑来装饰激活项/选中态
    if (type === NodeType.CompositeTreeNode) {
      toggleDirectory(item as Directory);
    }
  };

  React.useEffect(() => {
    ensureIsReady();
  }, []);

  const ensureIsReady = async () => {
    await fileTreeModelService.whenReady;
    // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
    // 这里需要重新取一下treeModel的值确保为最新的TreeModel
    await fileTreeModelService.treeModel.root.ensureLoaded;
    setIsReady(true);
  };

  const handleTreeReady = (handle: IRecycleTreeHandle) => {
    setTreeHandler({
      ...handle,
      getModel: () => fileTreeModelService.treeModel,
    });
  };

  const renderFileTree = () => {
    if (isReady) {
      return <RecycleTree
        height={height}
        width={width}
        itemHeight={FILE_TREE_NODE_HEIGHT}
        onReady={handleTreeReady}
        model={fileTreeModelService.treeModel}
      >
        {(props: INodeRendererProps) => <FileTreeNode
          item={props.item}
          itemType={props.itemType}
          decorationService={decorationService}
          labelService={labelService}
          onClick={handleItemClicked}
        />}
      </RecycleTree>;
    }
  };

  return <div
    className={styles.file_tree}
    tabIndex={-1}
  >
    {renderFileTree()}
  </div>;
});
