import * as React from 'react';
import * as styles from './extension-view.module.less';
import { TreeViewDataProviderMain } from '../api/main.thread.treeview';
import { TreeNode, CommandService, ExpandableTreeNode, TreeViewActionTypes, isUndefined, CommandRegistry, Command, IDisposable, localize } from '@ali/ide-core-browser';
import { RecycleTree } from '@ali/ide-core-browser/lib/components';
import { Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { observer } from 'mobx-react-lite';
import { ViewState, getIcon } from '@ali/ide-core-browser';
import { useInjectable } from '@ali/ide-core-browser';
import { ICtxMenuRenderer, IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';
import { useDisposable } from '@ali/ide-core-browser/lib/utils/react-hooks';

import { ExtensionViewService } from './extension-view.service';
import { ExtensionTreeViewModel, IExtensionTreeViewModel } from './extension-tree-view.model';
import { TreeViewItem, TreeViewBaseOptions } from '../../../common/vscode';

export interface ExtensionTabbarTreeViewProps {
  injector: Injector;
  options: TreeViewBaseOptions;
  dataProvider: TreeViewDataProviderMain;
  viewState: ViewState;
  rendered: boolean;
  viewId: string;
}

const TREE_VIEW_COMMAND_PREFIX = 'treeView';

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
  options,
  viewState,
  viewId,
}: React.PropsWithChildren<ExtensionTabbarTreeViewProps>) => {
  const [ nodes, setNodes] = React.useState<TreeNode<any>[]>([]);
  const extensionTreeViewModel: ExtensionTreeViewModel = useInjectable(ExtensionTreeViewModel);
  const { width, height } = viewState;
  const scrollContainerStyle = { width, height };
  const injector = useInjectable(INJECTOR_TOKEN);
  const extensionViewService: ExtensionViewService = injector.get(ExtensionViewService, [viewId]);
  const menuRegistry: IMenuRegistry = useInjectable(IMenuRegistry);
  const commandRegistry: CommandRegistry = useInjectable(CommandRegistry);
  const { canSelectMany, showCollapseAll }  = options || {};
  const initTreeData = () => {
    const model = copyMap(extensionTreeViewModel.getTreeViewModel(viewId));
    dataProvider.setVisible(viewId, true);
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
      dataProvider.onRevealEvent((itemId: string) => {
        setSelected([itemId]);
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
      args: [{treeViewId: viewId, treeItemId: node.id}, nodes.map((node) => ({treeViewId: viewId, treeItemId: node.id}))],
    });
  };

  const onSelectHandler = (selectedNodes: TreeNode<any>[]) => {
    if (nodes && selectedNodes.length > 0) {
      const selectedNodeIds = selectedNodes.map((node) => node.id as string);
      // 回传插件进程选中的节点
      setSelected(selectedNodeIds);

      // 仅在单选情况执行如下操作
      // 复选情况下不执行command等其他操作，仅选中元素
      if (selectedNodes.length === 1) {
        const node = selectedNodes[0];
        if (node.command) {
          if (injector) {
            const commandService: CommandService = injector.get(CommandService);
            commandService.executeCommand(node.command.id, ...(node.command.arguments || []));
          }
        } else {
          if (ExpandableTreeNode.is(node)) {
            onTwistieClickHandler(node);
            return;
          }
        }
      }
      setNodes(selectNode(selectedNodeIds));
    }
  };

  const onTwistieClickHandler = (node: TreeNode<any>) => {
    if (node && !node.expanded) {
      const copyModel = setExpanded(node.id, true);
      if ((node.children && node.children.length > 0) || copyModel.get(node.id)!.updated) {
        const addNodes = getAllSubChildren(node, copyModel);
        extensionTreeViewModel.setTreeViewModel(viewId, copyModel);
        setNodes(addTreeDatas(nodes, addNodes, node));
      } else {
        // 加载新数据
        const newNodes = [...nodes];
        copyModel.set(node.id, {
          ...copyModel.get(node.id),
          isLoading: true,
        });
        extensionTreeViewModel.setTreeViewModel(viewId, copyModel);
        setNodes(newNodes);
        checkIfNeedExpandChildren(nodes, copyModel);
      }
    } else {
      const copyModel = setExpanded(node.id, false);
      const deleteNodes = getAllSubChildren(node, copyModel);

      extensionTreeViewModel.setTreeViewModel(viewId, copyModel);
      setNodes(removeTreeDatas(nodes, deleteNodes, node));
    }
  };

  const selectNode = (ids: string[]) => {
    const idSet = new Set(ids);
    const newNodes = nodes.slice(0);
    for (const n of newNodes) {
      if (idSet.has(n.id as string)) {
        n.selected = true;
      }
    }
    return newNodes;
  };

  const collapseAll = () => {
    const model = extensionTreeViewModel.getTreeViewModel(viewId);
    const copyModel = copyMap(model);
    for (const [key, value] of copyModel) {
      copyModel.set(key, {
        ...value,
        expanded: false,
      });
    }
    extensionTreeViewModel.setTreeViewModel(viewId, copyModel);
    const nodes = extensionTreeViewModel.getTreeViewNodes(viewId);
    checkIfNeedExpandChildren(nodes, copyModel);
  };

  useDisposable(() => {
    const disposables: IDisposable[] = [];
    if (showCollapseAll) {
      const collapseCommand: Command = {
        id: `${TREE_VIEW_COMMAND_PREFIX}_COLLAPSE_ALL_${viewId}`,
        label: localize('treeview.command.action.collapse'),
        iconClass: getIcon('collapse-all'),
      };
      disposables.push(
        commandRegistry.registerCommand(collapseCommand, {
          execute: () => {
            collapseAll();
          },
        }),
        menuRegistry.registerMenuItem(MenuId.ViewTitle, {
          command: collapseCommand.id,
          when: `view == ${viewId}`,
          group: 'navigation',
          order: 10000, // keep the last position
        }),
      );
    }
    return disposables;
  }, []);

  const getAllSubChildren = (node: TreeNode<any>, model: Map<string | number, IExtensionTreeViewModel>) => {
    const parentModel = model.get(node.id);
    let result: TreeNode<any>[] = [];
    const children = parentModel && parentModel.children || [];
    for (const child of children) {
      const childModel = model.get(child.id);
      result.push(child);
      if (childModel && childModel.expanded) {
        result = result.concat(getAllSubChildren(child, model));
      }
    }
    return result;
  };

  const getInlineMenu = (node: TreeNode<any>) => {
    const contextValue = node.contextValue;
    const menus = extensionViewService.getInlineMenus(contextValue);
    return [{
      location: ExpandableTreeNode.is(node) ? TreeViewActionTypes.TreeContainer : TreeViewActionTypes.TreeNode_Right,
      component: <InlineActionBar context={[{treeViewId: viewId, treeItemId: node.id}]} menus={menus} separator='inline' />,
    }];
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
          copyModel.set(node.id, {
            ...nodeModel,
            isLoading: true,
          });
          promises.push(dataProvider.resolveChildren(node && node.id as string).then((childrens: TreeNode<any>[]) => {
            // 简化节点模型，带parent会导致参数序列化循环引用问题
            childrens = childrens.map((child) => {
              return {
                ...child,
              };
            });
            copyModel.set(node.id, {
              ...nodeModel,
              updated: true,
              isLoading: false,
            });
            node.children = childrens;
            return node;
          }));
        }
       }
    }

    if (promises.length === 0) {
      const newNodes = [...checkList];
      extensionTreeViewModel.setTreeViewModel(viewId, copyModel);
      setNodes(newNodes);
      return nodes;
    }

    return Promise.all(promises).then(([...nodes]) => {
      let newNodes = checkList;
      for (const node of nodes) {
        const nodeModel = copyModel.get(node.id);
        copyModel.set(node.id, {
          ...nodeModel,
          children: node.children,
        });
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

  const setSelected = (ids: string[]): Map<string | number, IExtensionTreeViewModel> => {
    const model = extensionTreeViewModel.getTreeViewModel(viewId);
    const idSet = new Set(ids);
    const copyModel = copyMap(model);
    for (const [key, value] of model) {
      if (idSet.has(key as string)) {
        copyModel.set(key, {
          ...value,
          selected: true,
        });
      } else {
        copyModel.set(key, {
          ...value,
          selected: false,
        });
      }
    }
    extensionTreeViewModel.setTreeViewModel(viewId, copyModel);
    dataProvider.setSelection(viewId, Array.from(idSet));
    return copyModel;
  };

  const setExpanded = (id: string | number, expanded: boolean): Map<string | number, IExtensionTreeViewModel> => {
    const model = extensionTreeViewModel.getTreeViewModel(viewId);
    const copyModel = copyMap(model);
    for (const [key, value] of model) {
      if (key === id) {
        copyModel.set(key, {
          ...value,
          expanded,
        });
        break;
      }
    }
    extensionTreeViewModel.setTreeViewModel(viewId, copyModel);
    dataProvider.setExpanded(viewId, id, expanded);
    return copyModel;
  };

  if (!nodes) {
    return <div className={styles.kt_extension_view}>Loading ... </div>;
  }

  const effectNodes = React.useMemo(() => {
    const model = extensionTreeViewModel.getTreeViewModel(viewId);
    return nodes.map((node) => {
      const nodeModel = model.get(node.id);
      let description = node.description;
      if (!node.name && !node.label && !node.description) {
        description = '——';
      }

      const actions = getInlineMenu(node);

      return {
        ...node,
        ...nodeModel,
        description,
        actions,
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
      multiSelectable={canSelectMany}
    />
  </div>;
});
