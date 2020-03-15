import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ViewState, useInjectable } from '@ali/ide-core-browser';
import * as styles from './file-tree.module.less';
import { RecycleTree, INodeRendererProps, TreeModel } from '@ali/ide-components';
import { FileTreeNode, FILE_TREE_NODE_HEIGHT } from './file-tree-node';
import { FileTreeService } from './file-tree.service';
import { FileTreeModelService } from './services/file-tree-model.service';

export const FileTree = observer(({
  viewState,
}: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const [isReady, setIsReady] = React.useState<boolean>(false);
  const { width, height } = viewState;
  // const fileTreeService = useInjectable<FileTreeService>(FileTreeService);
  const { treeModel } = useInjectable<FileTreeModelService>(FileTreeModelService);
  const handleItemClicked = (...args) => {
    // console.log(args);
  };

  React.useEffect(() => {
    ensureIsReady();
  }, []);

  const ensureIsReady = async () => {
    // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
    await treeModel.root.ensureLoaded;
    setIsReady(true);
  };

  const renderFileTree = () => {
    if (isReady) {
      return <RecycleTree
        height={height}
        width={width}
        itemHeight={FILE_TREE_NODE_HEIGHT}
        model={treeModel}
      >
        {(props: INodeRendererProps) => <FileTreeNode
          item={props.item}
          itemType={props.itemType}
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
