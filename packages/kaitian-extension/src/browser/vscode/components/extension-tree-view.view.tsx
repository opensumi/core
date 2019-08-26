import * as React from 'react';
import * as styles from './extension-view.module.less';
import { TreeViewDataProviderMain } from '../api/main.thread.treeview';
import { TreeNode, CommandService, MenuPath } from '@ali/ide-core-common';
import { RecycleTree } from '@ali/ide-core-browser/lib/components';
import { Injector } from '@ali/common-di';
import { observer } from 'mobx-react-lite';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { ViewState } from '@ali/ide-activity-panel';
import { ExtensionTreeViewModel, IExtensionTreeNodeModel } from './extension-tree-view.model';

export interface ExtensionTabbarTreeViewProps {
  injector: Injector;
  dataProvider: TreeViewDataProviderMain;
  viewState: ViewState;
  rendered: boolean;
  inlineMenuPath: MenuPath;
  contextMenuPath: MenuPath;
}

const addTreeDatas = (oldNodes: TreeNode<any>[], newNodes: TreeNode<any>[], parentNode?: TreeNode<any>) => {
  let spliceIndex = 0;
  if (!parentNode) {
    return oldNodes;
  }
  oldNodes = oldNodes.slice(0);
  newNodes = newNodes.map((node: TreeNode<any>) => {
    const depth = node.parent ? node.parent.depth + 1 : parentNode.depth + 1;
    return {
      ...node,
      depth,
    };
  });
  for (let index = 0; index < oldNodes.length; index++) {
    if (oldNodes[index].id === parentNode.id) {
      spliceIndex = index;
      oldNodes.splice(spliceIndex + 1, 0, ...newNodes);
      break;
    }
  }
  return oldNodes;
};

const removeTreeDatas = (oldNodes: TreeNode<any>[], deleteNodes: TreeNode<any>[], parentNode: TreeNode<any>) => {
  let spliceIndex = 0;
  oldNodes = oldNodes.slice(0);
  for (let index = 0; index < oldNodes.length; index++) {
    if (oldNodes[index].id === parentNode.id) {
      spliceIndex = index;
      oldNodes.splice(spliceIndex + 1, deleteNodes.length);
      break;
    }
  }
  return oldNodes;
};

export const ExtensionTabbarTreeView = observer(({
  injector,
  dataProvider,
  viewState,
  contextMenuPath,
}: React.PropsWithChildren<ExtensionTabbarTreeViewProps>) => {
  const [nodes, setNodes] = React.useState<TreeNode<any>[]>([]);
  const { width, height, opened } = viewState;
  const scrollContainerStyle = { width, height };
  const extensionTreeViewModel = injector.get(ExtensionTreeViewModel);
  const cache = extensionTreeViewModel.cache;
  const model = extensionTreeViewModel.model;

  const initTreeData = () => {
    dataProvider.resolveChildren().then((data: TreeNode<any>[]) => {
      checkIfNeedExpandChildren(data);
    });
  };

  React.useEffect(() => {
    if (dataProvider) {
      initTreeData();
      dataProvider.onTreeDataChanged(() => {
        initTreeData();
      });
    }
  }, []);

  const contentNumber = React.useMemo(() => {
    return Math.floor((height || 0) / 22);
  }, [height]);
  if (!opened) {
    return null;
  }

  const onSelectHandler = (selectedNodes: TreeNode<any>[]) => {
    if (nodes && selectedNodes.length > 0) {
      const node = selectedNodes[0];
      if (node.command) {
        if (injector) {
          const commandService: CommandService = injector.get(CommandService);
          commandService.executeCommand(node.command.command, node.command.arguments);
        }
        return;
      } else {
        onTwistieClickHandler(node);
      }
    }
  };

  const onTwistieClickHandler = (node: TreeNode<any>) => {
    const nodeModel = model.get(node.id);
    if (nodeModel && !nodeModel.expanded) {
      model.set(node.id, {
        ...nodeModel,
        expanded: true,
      });
      if (cache.has(node.id)) {
        const addNodes = getAllSubCache(cache, model, node);
        setNodes(addTreeDatas(nodes, addNodes, node));
      } else {
        checkIfNeedExpandChildren(nodes.map((child) => {
          if (child.id === node.id) {
            return {
              ...node,
              expanded: true,
            };
          } else {
            return child;
          }
        }));
      }
    } else {
      model.set(node.id, {
        ...nodeModel,
        expanded: false,
      });
      const deleteNodes = getAllSubCache(cache, model, node);
      setNodes(removeTreeDatas(nodes, deleteNodes, node));
    }
  };

  const getAllSubCache = (cache: Map<any, TreeNode<any>[]>, model: Map<any, IExtensionTreeNodeModel>, node: TreeNode<any>) => {
    const cacheNodes: TreeNode<any>[] = cache.get(node.id) || [];
    let result: TreeNode<any>[] = [];
    for (let sub of cacheNodes) {
      const subModel = model.get(sub.id);
      sub = {
        ...sub,
        depth: node ? node.depth + 1 : 0,
        parent: node,
      };
      result.push(sub);
      if (subModel && subModel.expanded) {
        result = result.concat(getAllSubCache(cache, model, sub));
      }
    }
    return result;
  };

  const checkIfNeedExpandChildren = (nodes: TreeNode<any>[], refresh?: boolean) => {
    const checkList = nodes.slice(0);
    const promises: Promise<any>[] = [];
    if (checkList.length > 0) {
      for (const node of checkList) {
        model.set(node.id, {
          ...model.get(node.id),
          selected: node.selected || false,
          expanded: node.expanded || false,
          focused: node.focused || false,
        });
        if (node.expanded && !cache.has(node.id)) {
          promises.push(dataProvider.resolveChildren(node && node.id as string).then((childrens: TreeNode<any>[]) => {
            childrens = childrens.map((child) => {
              return {
                ...child,
                parent: node,
              };
            });
            cache.set(node.id, childrens);
          }));
        }
      }
    }
    if (promises.length === 0) {
      setNodes(nodes);
      return nodes;
    }
    return Promise.all(promises).then(() => {
      let newNodes = checkList;
      const cacheKeys = cache.keys();
      for (const id of cacheKeys) {
        const subModel = model.get(id);
        if (subModel && subModel.updated) {
          continue;
        } else {
          model.set(id, {
            ...subModel,
            updated: true,
          });
        }
        const cacheNodes = cache.get(id);
        if (!cacheNodes) {
          continue;
        }
        newNodes = addTreeDatas(newNodes, cacheNodes, newNodes.find((node) => node.id === id));
      }
      setNodes(newNodes);
      return newNodes;
    }).then((data) => {
      return checkIfNeedExpandChildren(data);
    });
  };

  const onContextMenuHandler = (nodes: TreeNode<any>[], event: React.MouseEvent<HTMLElement>) => {
    const contextMenuRenderer: ContextMenuRenderer = injector.get(ContextMenuRenderer);
    const { x, y } = event.nativeEvent;
    const data = {
      x,
      y,
      ...nodes[0],
    };
    console.log(data, 'data==>');
    contextMenuRenderer.render(contextMenuPath, data);
  };

  if (!nodes) {
    return <div className={styles.kt_extension_view}>Loading ... </div>;
  }

  return <div className={styles.kt_extension_view}>
    <RecycleTree
      nodes={nodes.map((node) => {
        const nodeModel = model.get(node.id);
        return {
          ...node,
          ...nodeModel,
        };
      })}
      scrollContainerStyle={
        scrollContainerStyle
      }
      contentNumber={contentNumber}
      onSelect={onSelectHandler}
      onContextMenu={onContextMenuHandler}
      onTwistieClickHandler={onTwistieClickHandler}
    >
    </RecycleTree>
  </div>;
});
