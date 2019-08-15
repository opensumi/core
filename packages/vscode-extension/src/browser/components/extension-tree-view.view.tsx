import * as React from 'react';
import * as styles from './extension-view.module.less';
import { TreeViewDataProviderMain } from '../api/main.thread.treeview';
import { TreeNode } from '@ali/ide-core-common';
import { RecycleTree } from '@ali/ide-core-browser/lib/components';
export interface ExtensionTabbarTreeViewProps {
  dataProvider?: TreeViewDataProviderMain;
  width?: number;
  height?: number;
}

export const ExtensionTabbarTreeView = ({
  dataProvider,
  width,
  height,
}: React.PropsWithChildren<ExtensionTabbarTreeViewProps>) => {
  const [nodes, setNodes] = React.useState<TreeNode<any>[]>([]);
  const scrollContainerStyle = {
    height: height || 0,
    width: width || 0,
  };
  React.useEffect(() => {
    if (dataProvider) {
      dataProvider.resolveChildren().then((data: TreeNode<any>[]) => {
        setNodes(data);
      });
    }
  }, []);
  const contentNumber = React.useMemo(() => {
    return Math.floor((height || 0) / 22);
  }, [height]);
  if (!dataProvider) {
    return <span> Please provider dataProvider !</span>;
  } else {
    if (!nodes) {
      return <div className={ styles.kt_extension_view }>Loading ... </div>;
    }
    return <div className={ styles.kt_extension_view }>
      <RecycleTree
        nodes = { nodes }
        scrollContainerStyle = {
          scrollContainerStyle
        }
        contentNumber = { contentNumber }
      >
      </RecycleTree>
    </div>;
  }
};
