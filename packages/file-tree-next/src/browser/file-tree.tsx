import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ViewState, useInjectable } from '@ali/ide-core-browser';
import * as styles from './file-tree.module.less';
import { RecycleTree, INodeRendererProps, TreeModel } from '@ali/ide-components';
import { FileTreeModel } from './file-tree-model';
import { FileTreeNode, FILE_TREE_NODE_HEIGHT } from './file-tree-node';
import { FileTreeService } from './file-tree.service';

export const FileTree = observer(({
  viewState,
}: React.PropsWithChildren<{viewState: ViewState}>) => {
  const { width, height } = viewState;
  const fileTreeService = useInjectable<FileTreeService>(FileTreeService);
  const fileTreeModel  = useInjectable<TreeModel>(FileTreeModel, [fileTreeService]);
  const handleItemClicked = (...args) => {
    // console.log(args);
  };

  return <div
    className={styles.file_tree}
    tabIndex={-1}
  >
    <RecycleTree
      height={height}
      width={width}
      itemHeight={FILE_TREE_NODE_HEIGHT}
      model={fileTreeModel}
    >
      {(props: INodeRendererProps) => <FileTreeNode
        item={props.item}
        itemType={props.itemType}
        onClick={handleItemClicked}
        />}
    </RecycleTree>
  </div>;
});
