import * as React from 'react';
import { TreeContainer, TreeNode } from '../tree';

export interface VariablesTreeProps {
  /**
   * Tree组件根路径
   */
  node: TreeNode<any>;
  /**
   * 缩进大小
   *
   * @type {number}
   * @memberof VariablesTreeProps
   */
  leftPadding?: number;
  /**
   * 基础缩进
   *
   * @type {number}
   * @memberof VariablesTreeProps
   */
  defaultLeftPadding?: number;
  /**
   * 单个节点高度
   */
  itemLineHeight?: number;
}

export interface VariablesModel {
  expanded?: boolean;
  node: TreeNode;
}

export const VariablesTree = (
  {
    node,
    leftPadding = 8,
    defaultLeftPadding = 0,
    itemLineHeight = 22,
  }: VariablesTreeProps,
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
          node: item,
        });
      }
      if (!item.hasChildren) {
        nodes.push({
          id: item.id,
          name: item.name,
          title: item.title,
          tooltip: item.tooltip,
          description: item.description,
          descriptionClass: item.descriptionClass,
          labelClass: item.labelClass,
          afterLabel: item.afterLabel,
          children: item.children,
          isLoading: item.isLoading,
          badge: item.badge,
          depth,
          parent: item.parent,
        });
      } else {
        if (!nodeModel) {
          nodeModel =  {
            expanded: false,
            node: item,
          };
        }
        nodes.push({
          id: item.id,
          name: item.name,
          title: item.title,
          tooltip: item.tooltip,
          description: item.description,
          descriptionClass: item.descriptionClass,
          labelClass: item.labelClass,
          afterLabel: item.afterLabel,
          children: item.children,
          isLoading: item.isLoading,
          badge: item.badge,
          depth,
          parent: item.parent,
          expanded: nodeModel && typeof nodeModel.expanded === 'boolean' ? nodeModel.expanded : undefined,
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

  const onSelect = async (nodes: TreeNode[]) => {
    const selectNode = nodes[0];
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
    const res = extractNodes([node]);
    setModel(res.models);
    setNodes(res.nodes);
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
    height: (node.title ? renderNodes.length + 1 : renderNodes.length) * itemLineHeight,
    userSelect: 'text',
  } as React.CSSProperties;

  return <div style={contentStyle}>
    <TreeContainer
      nodes={renderNodes}
      style={contentStyle}
      multiSelectable={false}
      itemLineHeight={itemLineHeight}
      leftPadding={leftPadding}
      defaultLeftPadding={defaultLeftPadding}
      onSelect={onSelect}
      draggable={false}
      foldable={true}
      outline={false}
    />
  </div>;
};

VariablesTree.displayName = 'VariablesTree';
