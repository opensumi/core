import * as React from 'react';
import * as styles from './extension-view.module.less';
import { TreeViewDataProviderMain } from '../api/main.thread.treeview';
import { TreeNode, CommandService, ExpandableTreeNode, TreeViewActionTypes, isUndefined } from '@ali/ide-core-common';
import { RecycleTree } from '@ali/ide-core-browser/lib/components';
import { Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { observer } from 'mobx-react-lite';
import { ViewState } from '@ali/ide-core-browser';
import { useInjectable } from '@ali/ide-core-browser';
import { ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';

import { ExtensionViewService } from './extension-view.service';
import { ExtensionTreeViewModel, IExtensionTreeViewModel } from './extension-tree-view.model';
import { TreeViewItem } from '../../../common/vscode';

export interface ExtensionTabbarTreeViewProps {
  injector: Injector;
  dataProvider: TreeViewDataProviderMain;
  viewState: ViewState;
  rendered: boolean;
  viewId: string;
}

const addTreeDatas = (oldNodes: TreeNode<any>[], newNodes: TreeNode<any>[], parentNode?: TreeNode<any>) => {
  let spliceIndex = 0;
  if (!parentNode) {
    return oldNodes;
  }
  oldNodes = oldNodes.slice(0);
  newNodes = newNodes.map((node: TreeNode<any>) => {
    const depth = node.parent && node.parent.depth ? node.parent.depth + 1 : (parentNode.depth || 0) + 1;
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
  dataProvider,
  viewState,
  viewId,
}: React.PropsWithChildren<ExtensionTabbarTreeViewProps>) => {
  const [ nodes, setNodes] = React.useState<TreeNode<any>[]>([]);
  const extensionTreeViewModel: ExtensionTreeViewModel = useInjectable(ExtensionTreeViewModel);
  const { width, height } = viewState;
  const scrollContainerStyle = { width, height };
  const injector = useInjectable(INJECTOR_TOKEN);
  const extensionViewService: ExtensionViewService = injector.get(ExtensionViewService, [viewId]);
  const initTreeData = () => {
    const model = copyMap(extensionTreeViewModel.getTreeViewModel(viewId));
    dataProvider.resolveChildren().then((data: TreeNode<any>[]) => {
      extensionTreeViewModel.setTreeViewNodes(viewId, data);
      checkIfNeedExpandChildren(data, model);
    });
  };

  const refresh = (itemsToRefresh?: TreeViewItem) => {
    const model = copyMap(extensionTreeViewModel.getTreeViewModel(viewId));
    // 更新所有元素状态
    for (const [key, value] of model) {
      if (!isUndefined(value.expanded)) {
        model.set(key, {
          ...value,
          updated: false,
        });
      }
    }
    if (!itemsToRefresh) {
      dataProvider.resolveChildren().then((data: TreeNode<any>[]) => {
        checkIfNeedExpandChildren(data, model);
      });
    } else {
      const defaultNodes = extensionTreeViewModel.getTreeViewNodes(viewId).slice(0);
      if (defaultNodes) {
        checkIfNeedExpandChildren(defaultNodes, model);
      } else {
        dataProvider.resolveChildren().then((data: TreeNode<any>[]) => {
          checkIfNeedExpandChildren(data, model);
        });
      }
    }
  };

  React.useEffect(() => {
    if (dataProvider) {
      initTreeData();
      dataProvider.onTreeDataChanged((itemsToRefresh?: TreeViewItem) => {
        refresh(itemsToRefresh);
      });
    }
  }, [dataProvider]);

  const copyMap = (oldMap: Map<any, any>) => {
    const newMap: Map<any, any> = new Map();
    for (const [key, value] of oldMap) {
      newMap.set(key, value);
    }
    return newMap;
  };

  const onContextMenuHandler = (nodes: TreeNode<any>[], event: React.MouseEvent<HTMLElement>) => {
    const { x, y } = event.nativeEvent;
    // TreeViewAPI只处理单选操作
    const node = nodes[0];

    const [, menuNodes] = extensionViewService.getMenuNodes(node.contextValue);
    const ctxMenuRenderer: ICtxMenuRenderer = injector.get(ICtxMenuRenderer);

    ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      context: [node],
    });
  };

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
    const model = extensionTreeViewModel.getTreeViewModel(viewId);
    const nodeModel = model.get(node.id);
    const copyModel = copyMap(model);
    if (node && !node.expanded) {
      copyModel.set(node.id, {
        ...nodeModel,
        expanded: true,
      });
      if (node.children.length > 0 || copyModel.get(node.id).updated) {
        const addNodes = getAllSubChildren(node, copyModel);
        extensionTreeViewModel.setTreeViewModel(viewId, copyModel);
        setNodes(addTreeDatas(nodes, addNodes, node));
      } else {
        checkIfNeedExpandChildren(nodes, copyModel);
      }
    } else {
      copyModel.set(node.id, {
        ...nodeModel,
        expanded: false,
      });
      const deleteNodes = getAllSubChildren(node, copyModel);

      extensionTreeViewModel.setTreeViewModel(viewId, copyModel);
      setNodes(removeTreeDatas(nodes, deleteNodes, node));
    }
  };

  const getAllSubChildren = (node: TreeNode<any>, model: Map<string, IExtensionTreeViewModel>) => {
    let result: TreeNode<any>[] = [];
    const children = node.children || [];
    result = result.concat(children);
    for (const sub of children) {
      const subModel = model.get(sub.id);
      if (subModel && subModel.expanded) {
        result = result.concat(getAllSubChildren(sub, model));
      }
    }
    return result;
  };

  const setInlineMenu = (nodes: TreeNode<any>[]) => {
    if (!nodes.length) {
      return nodes;
    }

    const contextValue = nodes[0].contextValue;
    const menus = extensionViewService.getInlineMenus(contextValue);

    return nodes.map((node) => {
      return {
        ...node,
        actions: [{
          location: TreeViewActionTypes.TreeNode_Right,
          component: <InlineActionBar context={[node]} menus={menus} seperator='inline' />,
        }],
      };
    });
  };

  const checkIfNeedExpandChildren = (nodes: TreeNode<any>[], copyModel: Map<string | number, IExtensionTreeViewModel>) => {
    const checkList = nodes.slice(0);
    const promises: Promise<any>[] = [];
    if (checkList.length > 0) {
      for (const node of checkList) {
        if (!copyModel.has(node.id)) {
          copyModel.set(node.id, {
            updated: false,
            expanded: node.expanded || false,
            selected: node.selected || false,
            focused: node.focused || false,
          });
        }
        const nodeModel = copyModel.get(node.id);
        if (nodeModel && nodeModel.expanded && !nodeModel.updated) {
          promises.push(dataProvider.resolveChildren(node && node.id as string).then((childrens: TreeNode<any>[]) => {
            childrens = childrens.map((child) => {
              return {
                ...child,
                parent: node,
              };
            });
            copyModel.set(node.id, {
              ...nodeModel,
              updated: true,
            });
            node.children = childrens;
            return node;
          }));
        }
       }
    }
    if (promises.length === 0) {
      let newNodes = [...checkList];
      newNodes = setInlineMenu(newNodes);
      extensionTreeViewModel.setTreeViewModel(viewId, copyModel);
      setNodes(newNodes);
      return nodes;
    }
    return Promise.all(promises).then(([...nodes]) => {
      let newNodes = [...checkList];
      for (const node of nodes) {
        const nodeModel = copyModel.get(node.id);
        if (ExpandableTreeNode.is(node) && nodeModel && nodeModel.expanded && node.children.length > 0) {
          newNodes = addTreeDatas(newNodes, node.children as TreeNode<any>[], checkList.find((newNode) => newNode.id === node.id));
        }
      }
      return {
        data: newNodes,
        model: copyModel,
      };
    }).then(({data, model}) => {
      return checkIfNeedExpandChildren(data, model);
    });
  };

  if (!nodes) {
    return <div className={styles.kt_extension_view}>Loading ... </div>;
  }

  const effectNodes = React.useMemo(() => {
    const model = extensionTreeViewModel.getTreeViewModel(viewId);
    return nodes.map((node) => {
      const nodeModel = model.get(node.id);
      return {
        ...node,
        ...nodeModel,
      };
    });
  }, [nodes]);

  return <div className={styles.kt_extension_view}>
    <RecycleTree
      nodes={effectNodes}
      scrollContainerStyle={ scrollContainerStyle }
      containerHeight={ height }
      onSelect={onSelectHandler}
      onContextMenu={onContextMenuHandler}
      onTwistieClick={onTwistieClickHandler}
    />
  </div>;
});
