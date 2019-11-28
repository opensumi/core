import * as React from 'react';
import { TreeNode, isUndefined, ExpandableTreeNode } from '@ali/ide-core-node';
import { TreeContainer, PerfectScrollbar } from '@ali/ide-core-browser/lib/components';
import { LabelService } from '@ali/ide-core-browser/lib/services';

export interface FileDialogTreeProps {
  /**
   * 宽度
   */
  width?: number;
  /**
   * 高度
   */
  height?: number;
  /**
   * 是否支持多选
   */
  multiSelectable?: boolean;
  /**
   * 文件夹是否可选中
   */
  canSelectFolders?: boolean;
  /**
   * 文件是否可选中
   */
  canSelectFiles?: boolean;
  /**
   * 是否展开第一个节点
   */
  expandedOnFirst?: boolean;
  /**
   * 获取图标接口
   */
  labelService?: LabelService;
  /**
   * 选中函数
   */
  onSelect?: any;
  /**
   * Tree组件根路径
   */
  node: TreeNode<any>;
  /**
   * 缩进大小
   *
   * @type {number}
   * @memberof FileDialogTreeProps
   */
  leftPadding?: number;
  /**
   * 基础缩进
   *
   * @type {number}
   * @memberof FileDialogTreeProps
   */
  defaultLeftPadding?: number;
  /**
   * 单个节点高度
   */
  itemLineHeight?: number;
}

export interface VariablesModel {
  expanded?: boolean;
  selected?: boolean;
  node: TreeNode;
}

export const FileDialogTree = (
  {
    height,
    width,
    node,
    leftPadding = 8,
    defaultLeftPadding = 0,
    itemLineHeight = 22,
    expandedOnFirst,
    labelService,
    multiSelectable,
    onSelect,
    canSelectFolders,
    canSelectFiles,
  }: FileDialogTreeProps,
) => {
  const [nodes, setNodes] = React.useState<TreeNode<any>[]>([]);
  const [model, setModel] = React.useState<Map<string | number, VariablesModel>>(new Map());

  const extractNodes = (items: TreeNode<any>[], depth: number = 0, defaultModel: Map<string | number, VariablesModel> = new Map()): {
    models: Map<string | number, VariablesModel>,
    nodes: TreeNode[],
  } => {
    const copyModel: Map<string | number, VariablesModel> = defaultModel.size > 0 ? copyMap(defaultModel) : copyMap(model);
    let nodes: TreeNode[] = [];
    items.forEach((item) => {
      let nodeModel = copyModel.get(item.id);
      if (nodeModel) {
        copyModel.set(item.id, nodeModel);
        item = nodeModel.node;
      } else {
        copyModel.set(item.id, {
          expanded: false,
          selected: false,
          node: item,
        });
      }
      if (!item.hasChildren) {
        nodes.push({
          id: item.id,
          name: item.name,
          uri: item.uri,
          tooltip: item.tooltip,
          description: item.description,
          children: item.children,
          icon: item.uri && labelService ? labelService.getIcon(item.uri) : '',
          depth,
          parent: item.parent,
          selected: nodeModel && typeof nodeModel.selected === 'boolean' ? nodeModel.selected : undefined,
        });
      } else {
        if (!nodeModel) {
          nodeModel =  {
            expanded: false,
            selected: false,
            node: item,
          };
        }
        nodes.push({
          id: item.id,
          name: item.name,
          uri: item.uri,
          tooltip: item.tooltip,
          description: item.description,
          children: item.children,
          icon: item.uri && labelService ? labelService.getIcon(item.uri, {isDirectory: true, isOpenedDirectory: nodeModel.expanded}) : '',
          depth,
          parent: item.parent,
          expanded: nodeModel && typeof nodeModel.expanded === 'boolean' ? nodeModel.expanded : undefined,
          selected: nodeModel && typeof nodeModel.selected === 'boolean' ? nodeModel.selected : undefined,
        } as TreeNode);
        if (nodeModel.expanded) {
          const children = extractNodes(item.children, depth + 1, copyModel);
          nodes = nodes.concat(children.nodes);
          mergeMap(copyModel, children.models);
        }
      }
    });
    return {
      nodes,
      models: copyModel,
    };
  };

  const onSelectHandler = async (nodes: TreeNode[]) => {
    const selectNodes = nodes;
    const result: TreeNode[] = [];
    if (selectNodes.length === 0) {
      return ;
    }
    let modelMap = copyMap(model);
    modelMap = resetSelected(modelMap);
    selectNodes.forEach((selectNode) => {
      const nodeModel = modelMap.get(selectNode.id);
      if (!isUndefined(nodeModel.selected)) {
        if (!isUndefined(canSelectFiles) && !canSelectFiles) {
          if (!ExpandableTreeNode.is(selectNode)) {
            return ;
          }
        }
        if (!isUndefined(canSelectFolders) && !canSelectFolders) {
          if (ExpandableTreeNode.is(selectNode)) {
            return ;
          }
        }
        modelMap.set(selectNode.id, {
          ...nodeModel,
          selected: !nodeModel.selected,
        });
        result.push(selectNode);
      }
    });
    const res = extractNodes([node], 0, modelMap);
    setModel(res.models);
    setNodes(res.nodes);
    onSelect(result);
  };

  const resetSelected = (resetMap: Map<string |number, VariablesModel>) => {
    const copy = copyMap(resetMap);
    for (const [key, value] of copy) {
      copy.set(key, {
        ...value,
        selected: false,
      });
    }
    return copy;
  };

  const onTwistieClickHandler = async (selectNode: TreeNode) => {
    if (!selectNode) {
      return ;
    }
    const modelMap = copyMap(model);
    const nodeModel = modelMap.get(selectNode.id);
    if (nodeModel) {
      if (typeof nodeModel.expanded !== 'undefined') {
        modelMap.set(selectNode.id, {
          ...nodeModel,
          expanded: !nodeModel.expanded,
        });
        if (!nodeModel.expanded && nodeModel.node.children.length === 0) {
          await nodeModel.node.getChildren();
        }
        const res = extractNodes([node], 0, modelMap);
        setModel(res.models);
        setNodes(res.nodes);
      }
    }
  };

  const copyMap = (oldMap: Map<any, any>) => {
    const newMap: Map<any, any> = new Map();
    for (const [key, value] of oldMap) {
      newMap.set(key, value);
    }
    return newMap;
  };

  const mergeMap = (oldMap: Map<any, any>, newMap: Map<any, any>) => {
    for (const [key, value] of newMap) {
      oldMap.set(key, value);
    }
    return oldMap;
  };

  React.useEffect(() => {
    if (node) {
      const copyModel: Map<string | number, VariablesModel> = copyMap(model);
      const res = extractNodes([node], 0, copyModel.set(node.id, {expanded: !!expandedOnFirst, node}));
      setModel(res.models);
      setNodes(res.nodes);
    }
  }, [node]);

  const renderNodes = React.useMemo(() => {
    let order = 0;
    return nodes.map((node) => {
      let result;
      const nodeModel = model.get(node.id);
      if (nodeModel && nodeModel.node.hasChildren) {
        result =  {
          ...node,
          order,
          expanded: nodeModel.expanded || false,
        };
      } else {
        result =  {
          ...node,
          order,
        };
      }
      if (node.title) {
        order += 2;
      } else {
        order ++;
      }

      return result;
    });
  }, [nodes]);

  const contentStyle = {
    height,
    width,
    userSelect: 'text',
  } as React.CSSProperties;

  return <PerfectScrollbar style={contentStyle}>
    <TreeContainer
      nodes={renderNodes}
      style={contentStyle}
      multiSelectable={multiSelectable}
      itemLineHeight={itemLineHeight}
      leftPadding={leftPadding}
      defaultLeftPadding={defaultLeftPadding}
      onSelect={onSelectHandler}
      onTwistieClick={onTwistieClickHandler}
      draggable={false}
      outline={false}
    />
  </PerfectScrollbar>;
};

FileDialogTree.displayName = 'FileDialogTree';
