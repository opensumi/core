import * as React from 'react';
import * as styles from './extension-view.module.less';
import { TreeViewDataProviderMain } from '../api/main.thread.treeview';
import { TreeNode, CommandService } from '@ali/ide-core-common';
import { RecycleTree } from '@ali/ide-core-browser/lib/components';
import { Injector } from '@ali/common-di';
import { observer } from 'mobx-react-lite';
import { ViewState } from '@ali/ide-activity-panel/lib/browser/view-container-state';

export interface ExtensionTabbarTreeViewProps {
  injector?: Injector;
  dataProvider?: TreeViewDataProviderMain;
  viewState: ViewState;
  rendered: boolean;
}

const addTreeDatas = (oldNodes: TreeNode<any>[], newNodes: TreeNode<any>[], parentNode: TreeNode<any>) => {
  let spliceIndex = 0;
  oldNodes = oldNodes.slice(0);
  newNodes = newNodes.map((node: TreeNode<any>) => {
    return {
      ...node,
      depth: parentNode.depth + 1,
    };
  });
  for (let index = 0; index < oldNodes.length; index ++) {
    if (oldNodes[index].id === parentNode.id) {
      spliceIndex = index;
      oldNodes[index].expanded = true;
      oldNodes.splice(spliceIndex + 1, 0 , ...newNodes);
      break;
    }
  }
  return oldNodes;
};

const removeTreeDatas = (oldNodes: TreeNode<any>[], deleteNodes: TreeNode<any>[], parentNode: TreeNode<any>) => {
  let spliceIndex = 0;
  oldNodes = oldNodes.slice(0);
  for (let index = 0; index < oldNodes.length; index ++) {
    if (oldNodes[index].id === parentNode.id) {
      spliceIndex = index;
      oldNodes[index].expanded = false;
      oldNodes.splice(spliceIndex + 1, deleteNodes.length);
      break;
    }
  }
  return oldNodes;

};

const cache = new Map();

export const ExtensionTabbarTreeView = observer(({
  injector,
  dataProvider,
  viewState,
}: React.PropsWithChildren<ExtensionTabbarTreeViewProps>) => {
  const [nodes, setNodes] = React.useState<TreeNode<any>[]>([]);
  const {width, height} = viewState;
  const scrollContainerStyle = {width, height};
  console.log('rendered', width, height);
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
    const onSelect = (selectedNodes: TreeNode<any>[]) => {
      if (nodes && selectedNodes.length > 0) {
        const node = selectedNodes[0];
        if (node.command) {
          if (injector) {
            const commandService: CommandService = injector.get(CommandService);
            commandService.executeCommand(node.command.command, node.command.arguments);
          }
          return;
        }
        if (!node.expanded) {
          dataProvider.resolveChildren(node && node.id as string).then((data: TreeNode<any>[]) => {
            cache.set(node.id, data);
            setNodes(addTreeDatas(nodes, data, node));
          });
        } else {
          const data = cache.get(node.id);
          setNodes(removeTreeDatas(nodes, data, node));
        }
      }
    };
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
        onSelect = { onSelect }
      >
      </RecycleTree>
    </div>;
  }
});
