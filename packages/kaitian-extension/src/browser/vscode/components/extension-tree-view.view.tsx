import * as React from 'react';
import * as styles from './extension-view.module.less';
import { TreeViewDataProviderMain } from '../api/main.thread.treeview';
import { TreeNode, CommandService, MenuPath, memoize, ExpandableTreeNode } from '@ali/ide-core-common';
import { RecycleTree } from '@ali/ide-core-browser/lib/components';
import { Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { observer } from 'mobx-react-lite';
import { ViewState, ViewContextKeyRegistry, IContextKeyService } from '@ali/ide-core-browser';
import { useInjectable } from '@ali/ide-core-browser';
import { ICtxMenuRenderer, generateCtxMenu, MenuId, AbstractMenuService } from '@ali/ide-core-browser/lib/menu/next';

export interface IExtensionTreeNodeModel {
  selected?: boolean;
  expanded?: boolean;
  focused?: boolean;
  updated?: boolean;
}

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
  const [nodes, setNodes] = React.useState<TreeNode<any>[]>([]);
  const [model, setModel] = React.useState<Map<any, IExtensionTreeNodeModel>>(new Map());
  const { width, height } = viewState;
  const scrollContainerStyle = { width, height };
  const injector = useInjectable(INJECTOR_TOKEN);
  const menuService: AbstractMenuService = injector.get(AbstractMenuService);
  const viewContextKeyRegistry: ViewContextKeyRegistry = injector.get(ViewContextKeyRegistry);
  const contextKeyService = viewContextKeyRegistry.getContextKeyService(viewId) || injector.get(IContextKeyService);
  const viewItemContextKey = contextKeyService.createKey('viewItem', '');

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
    // 设置viewItem
    viewItemContextKey.set(node.contextValue);
    const menus = menuService.createMenu(MenuId.ViewItemContext, contextKeyService);
    const result = generateCtxMenu({ menus, separator: 'inline'  });
    const ctxMenuRenderer: ICtxMenuRenderer = injector.get(ICtxMenuRenderer);

    ctxMenuRenderer.show({
      anchor: { x, y },
      // 合并结果
      menuNodes: [...result[1]],
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
    const nodeModel = model.get(node.id);
    const copyModel = copyMap(model);
    if (node && !node.expanded) {
      copyModel.set(node.id, {
        ...nodeModel,
        expanded: true,
      });
      if (node.children.length > 0 || copyModel.get(node.id).updated) {
        const addNodes = getAllSubChildren(node, copyModel);
        setNodes(addTreeDatas(nodes, addNodes, node));
        setModel(copyModel);
      } else {
        checkIfNeedExpandChildren(nodes, copyModel);
      }
    } else {
      copyModel.set(node.id, {
        ...nodeModel,
        expanded: false,
      });
      const deleteNodes = getAllSubChildren(node, copyModel);
      setNodes(removeTreeDatas(nodes, deleteNodes, node));
      setModel(copyModel);
    }
  };

  const getAllSubChildren = (node: TreeNode<any>, model: Map<any, IExtensionTreeNodeModel>) => {
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
    const menus = menuService.createMenu(MenuId.ViewItemContext, contextKeyService);
    const result = generateCtxMenu({ menus, separator: 'inline'  });
    if (result[0].length > 0) {
      return nodes.map((node) => {
        return {
          ...node,
        };
      });
    } else {
      return nodes;
    }
  };

  const checkIfNeedExpandChildren = (nodes: TreeNode<any>[], copyModel: Map<any, IExtensionTreeNodeModel> = copyMap(model)) => {
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
      const newNodes = checkList;
      // newNodes = setInlineMenu(newNodes);
      setModel(copyModel);
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
      containerHeight={ height }
      onSelect={onSelectHandler}
      onContextMenu={onContextMenuHandler}
      onTwistieClick={onTwistieClickHandler}
    >
    </RecycleTree>
  </div>;
});
