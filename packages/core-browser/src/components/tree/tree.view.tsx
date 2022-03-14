import cls from 'classnames';
import React from 'react';

import { ValidateMessage } from '@opensumi/ide-components';
import { isOSX, Event } from '@opensumi/ide-core-common';

import {
  FileDecorationsProvider,
  ThemeProvider,
  IFileDecoration,
  ExpandableTreeNode,
  TreeViewAction,
} from '../../tree';

import { TreeContainerNode, CommandActuator } from './tree-node.view';
import styles from './tree.module.less';

import { TreeNode, SelectableTreeNode } from './';


export const TEMP_FILE_NAME = 'kt_template_file';
export interface TreeProps extends React.PropsWithChildren<any> {
  /**
   * 可渲染的树节点
   */
  readonly nodes: TreeNode<any>[];
  /**
   * 左侧缩进（单位 px）
   * 默认缩进计算通过：defaultLeftPadding + leftPadding * depth
   */
  readonly leftPadding?: number;
  /**
   * 默认左侧缩进（单位 px）
   * 默认缩进计算通过：defaultLeftPadding + leftPadding * depth
   */
  readonly defaultLeftPadding?: number;
  /**
   * 如果树组件支持多选，为`true`, 否则为 `false`
   */
  readonly multiSelectable?: boolean;
  /**
   * 是否在视图激活时自动滚动
   */
  readonly scrollIfActive?: boolean;
  /**
   * 是否可折叠
   */
  readonly foldable?: boolean;
  /**
   * 是否支持拖拽
   */
  readonly draggable?: boolean;
  /**
   * 是否可搜索
   */
  readonly searchable?: boolean;

  /**
   * 是否选中
   */
  readonly selected?: boolean;

  /**
   * 纯普通节点节点与包含可折叠节点在样式上存在左侧下拉展开图标占位
   * 需要通过判断处理掉折叠图标带来的边距影响，时上下Tree组件的基础边距达到对齐效果
   * 当isComplex值为True时，默认添加5px边距，否则为0
   */
  readonly isComplex?: boolean;

  /**
   * 选择事件回调
   */
  onSelect?: any;

  /**
   * 显示事件回调
   */
  onReveal?: any;

  /**
   * 折叠箭头点击回调
   */
  onTwistieClick?: any;

  /**
   * 右键菜单事件回调
   */
  onContextMenu?: any;

  /**
   * 拖拽事件回调
   */
  onDragStart?: any;
  onDragEnter?: any;
  onDragOver?: any;
  onDragLeave?: any;
  onDragEnd?: any;
  onDrag?: any;
  onDrop?: any;
  onChange?: any;
  onBlur?: any;
  /**
   * 节点中替换文本，需在node节点中存在hightlightRange时可用
   */
  replace?: string;
  /**
   * 筛选条件
   */
  filter?: string;
  /**
   * 节点高度
   */
  itemLineHeight?: number;
  /**
   * 工具栏定义
   */
  actions?: TreeViewAction[];

  /**
   * 是否一直展示工具栏，默认为 hover 出现
   */
  alwaysShowActions?: boolean;

  /**
   * 工具栏中Command执行逻辑
   */
  commandActuator?: CommandActuator;
  /**
   * 文件装饰器变化事件
   */
  notifyFileDecorationsChange?: Event<FileDecorationsProvider>;

  /**
   * 主题颜色变化事件
   */
  notifyThemeChange?: Event<ThemeProvider>;
  /**
   * 文件装饰器函数
   */
  fileDecorationProvider?: FileDecorationsProvider;
  /**
   * 主题颜色函数
   */
  themeProvider?: ThemeProvider;
  /**
   * 是否带焦点样式
   */
  outline?: boolean;
  /**
   * 编辑态校验函数
   */
  validate?: (node: TreeNode, value: string) => ValidateMessage | null;
}

export const defaultTreeProps: TreeProps = {
  nodes: [],
  leftPadding: 8,
  defaultLeftPadding: 8,
};

export const TreeContainer = ({
  nodes = defaultTreeProps.nodes,
  leftPadding = defaultTreeProps.leftPadding,
  defaultLeftPadding = defaultTreeProps.defaultLeftPadding,
  multiSelectable,
  onSelect,
  onTwistieClick,
  onContextMenu,
  onDragStart,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrag,
  onDrop,
  onChange,
  onBlur,
  onFocus,
  onReveal,
  draggable,
  foldable = true,
  editable,
  replace,
  actions,
  alwaysShowActions,
  commandActuator,
  themeProvider,
  fileDecorationProvider,
  notifyFileDecorationsChange,
  notifyThemeChange,
  itemLineHeight = 22,
  style,
  outline,
  validate,
  isComplex,
}: TreeProps) => {
  const [outerFocused, setOuterFocused] = React.useState<boolean>(false);
  const [outerDragOver, setOuterDragOver] = React.useState<boolean>(false);
  const [, refreshState] = React.useState<any>();

  const isEdited = editable && !!nodes!.find(<T extends TreeNode>(node: T, index: number) => !!node.isTemporary);

  const innerContextMenuHandler = (node, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const result: any = [];
    let contexts = [node];
    let isMenuActiveOnSelectedNode = false;
    if (!nodes) {
      return;
    }
    if (isEdited) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    for (const n of nodes as SelectableTreeNode[]) {
      if (n.selected) {
        if (node.id === n.id) {
          isMenuActiveOnSelectedNode = true;
        }
        result.push(n);
      }
    }
    // 如果右键菜单在已选中的元素触发，为多选菜单
    // 否则为单选菜单
    if (isMenuActiveOnSelectedNode) {
      contexts = result;
    }
    setOuterFocused(false);
    if (onContextMenu) {
      onContextMenu(contexts, event);
    }
  };

  const outerContextMenuHandler = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (isEdited) {
      return;
    }
    setOuterFocused(true);
    if (onContextMenu) {
      onContextMenu([], event);
    }
  };

  const selectRange = (nodes: any = [], node: TreeNode) => {
    const result: any[] = [];
    let from;
    let to;
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].selected) {
        to = i;
      }
      if (node.id === nodes[i].id) {
        from = i;
        break;
      }
    }
    // 优先向下查找选中节点
    for (let j = from; j < nodes.length; j++) {
      if (nodes[j].selected) {
        to = j;
      }
    }
    // 返回从from到to之间节点
    if (from > to) {
      for (let h = to; h <= from; h++) {
        result.push(nodes[h]);
      }
    } else {
      for (let n = from; n <= to; n++) {
        result.push(nodes[n]);
      }
    }
    return result;
  };

  const toggleNode = (nodes: any = [], node: TreeNode) => {
    const result: any[] = [];
    for (const n of nodes) {
      if (node.id === n.id) {
        if (!n.selected) {
          result.push(n);
        }
      } else {
        if (n.selected) {
          result.push(n);
        }
      }
    }
    return result;
  };

  const selectNode = (node: TreeNode) => [node];

  const selectHandler = (node, event) => {
    let selectedNodes: any;
    if (!node || isEdited) {
      return;
    }
    // 支持多选状态, 同时在非编辑状态时
    if (multiSelectable && !isEdited) {
      const shiftMask = hasShiftMask(event);
      const ctrlCmdMask = hasCtrlCmdMask(event);
      if (SelectableTreeNode.is(node)) {
        if (shiftMask) {
          selectedNodes = selectRange(nodes, node);
        } else if (ctrlCmdMask) {
          selectedNodes = toggleNode(nodes, node);
        } else {
          selectedNodes = selectNode(node);
        }
      }
    } else {
      selectedNodes = selectNode(node);
    }
    if (onSelect) {
      onSelect(selectedNodes, event);
    }
    setOuterFocused(false);
  };

  const twistieClickHandler = (node, event) => {
    if (onTwistieClick) {
      onTwistieClick(node, event);
    } else if (onSelect) {
      onSelect([node], event);
    }
  };

  const hasShiftMask = (event): boolean => {
    // Ctrl/Cmd 权重更高
    if (hasCtrlCmdMask(event)) {
      return false;
    }
    return event.shiftKey;
  };

  const hasCtrlCmdMask = (event): boolean => {
    const { metaKey, ctrlKey } = event;
    return (isOSX && metaKey) || ctrlKey;
  };

  const outerClickHandler = (event) => {
    setOuterFocused(true);
    // 让选中状态的节点失去焦点，保留选中状态
    if (onSelect) {
      onSelect([], event);
    }
  };

  const outerBlurHandler = (event) => {
    if (onBlur) {
      onBlur(event);
    }
    setOuterFocused(false);
    setOuterDragOver(false);
  };

  const outerFocusHandler = (event) => {
    if (onFocus) {
      onFocus(event);
    }
  };

  const getNodeTooltip = (node: TreeNode): string | undefined => {
    if (node.tooltip) {
      return node.tooltip;
    }
    if (node.uri) {
      const uri = node.uri.toString();
      return uri ? uri : undefined;
    }
    if (typeof node.name === 'string') {
      return node.name;
    }
  };

  const outerDropHandler = (event) => {
    if (onDrop) {
      onDrop('', event);
    }
    setOuterDragOver(false);
  };

  const outerDragOverHandler = (event) => {
    event.preventDefault();
    setOuterDragOver(true);
  };

  const outerDragLeaveHandler = (event) => {
    setOuterDragOver(false);
  };

  const outerDragStartHandler = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  React.useEffect(() => {
    if (notifyFileDecorationsChange) {
      const disposeble = notifyFileDecorationsChange(() => {
        refreshState({});
      });
      return () => disposeble.dispose();
    }
  }, [notifyFileDecorationsChange]);

  React.useEffect(() => {
    if (notifyThemeChange) {
      const disposeble = notifyThemeChange(() => {
        refreshState({});
      });
      return () => disposeble.dispose();
    }
  }, [notifyThemeChange]);

  return (
    <div
      className={cls(
        styles.treenode_container,
        outerFocused && styles.treenode_container_focused,
        outerDragOver && styles.treenode_all_focused,
      )}
      style={style}
      onBlur={outerBlurHandler}
      onFocus={outerFocusHandler}
      onContextMenu={outerContextMenuHandler}
      onDrop={outerDropHandler}
      onDragStart={outerDragStartHandler}
      onDragOver={outerDragOverHandler}
      onDragLeave={outerDragLeaveHandler}
      draggable={draggable}
      onClick={outerClickHandler}
      tabIndex={outline ? 0 : -1}
    >
      {nodes!.map(<T extends TreeNode>(node: T, index: number) => {
        if (fileDecorationProvider && themeProvider) {
          const deco: IFileDecoration = fileDecorationProvider.getDecoration(
            node.uri || (typeof node.name === 'string' && node.name) || node.id,
            ExpandableTreeNode.is(node),
          );
          if (deco) {
            node = {
              ...node,
              badge: deco.badge,
              color: themeProvider.getColor({ id: deco.color }),
              tooltip: `${getNodeTooltip(node)}•${deco.tooltip}`,
            };
          }
        }
        return (
          <TreeContainerNode
            node={node}
            leftPadding={leftPadding}
            defaultLeftPadding={defaultLeftPadding}
            key={`${node.id}-${index}`}
            onSelect={selectHandler}
            onTwistieClick={twistieClickHandler}
            onContextMenu={innerContextMenuHandler}
            onDragStart={onDragStart}
            onDragEnter={onDragEnter}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrag={onDrag}
            onDrop={onDrop}
            onChange={onChange}
            draggable={draggable}
            foldable={foldable}
            isEdited={isEdited}
            isComplex={isComplex}
            actions={node.actions || actions}
            replace={node.replace || replace}
            alwaysShowActions={alwaysShowActions}
            commandActuator={commandActuator}
            itemLineHeight={itemLineHeight}
            validate={validate}
          />
        );
      })}
    </div>
  );
};
