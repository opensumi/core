import cls from 'classnames';
import React from 'react';

import { Badge, Loading } from '@opensumi/ide-components';
import { ValidateInput, InputSelection, Icon } from '@opensumi/ide-components';
import { isUndefined, isString } from '@opensumi/ide-core-common';

import { KeyCode, Key } from '../../keyboard';
import { getIcon } from '../../style/icon/icon';
import { TreeViewAction, isTreeViewActionComponent } from '../../tree';

import styles from './tree.module.less';
import { TEMP_FILE_NAME } from './tree.view';

import { TreeNode, TreeViewActionTypes, ExpandableTreeNode, SelectableTreeNode, TreeNodeHighlightRange } from './';

export type CommandActuator<T = any> = (commandId: string, params: T) => void;

export interface TreeNodeProps extends React.PropsWithChildren<any> {
  node: TreeNode;
  // 缩进步长
  leftPadding?: number;
  // 默认左边距
  defaultLeftPadding?: number;
  // 选择事件
  onSelect?: any;
  // 箭头点击事件
  onTwistieClick?: any;
  // 右键事件
  onContextMenu?: any;
  // 拖拽事件
  onDragStart?: any;
  onDragEnter?: any;
  onDragOver?: any;
  onDragLeave?: any;
  onDrag?: any;
  // 验证函数
  validate?: any;
  // 是否可拖拽
  draggable?: boolean;
  // 是否处于编辑状态
  isEdited?: boolean;
  // 是否为复杂类型的Tree组件，即包含折叠节点
  isComplex?: boolean;
  // 节点按钮
  actions?: TreeViewAction[];
  // 高亮文本
  replace?: string;
  // 命令处理函数
  commandActuator?: CommandActuator;
}

const renderWithRangeAndReplace = (template: any, ranges?: TreeNodeHighlightRange[], replace?: string) => {
  if (isUndefined(template)) {
    return '';
  }
  if (isString(template)) {
    if (ranges) {
      const rangeLen = ranges.length;
      if (rangeLen > 0) {
        const content: any = [];
        for (let i = 0; i < rangeLen; i++) {
          content.push(
            <span key={`${i}-highlight-start`}>
              {i === 0 ? template.slice(0, ranges[i].start) : template.slice(ranges[i - 1].end, ranges[i].start)}
              <span className={cls(styles.search_match, replace && styles.replace)} key={`${i}-highlight-content`}>
                {template.slice(ranges[i].start, ranges[i].end)}
              </span>
              <span className={replace && styles.search_replace} key={`${i}--highlight-end`}>
                {replace}
              </span>
              {i + 1 < rangeLen ? template.slice(ranges[i + 1].start) : template.slice(ranges[i].end)}
            </span>,
          );
        }
        return content;
      } else {
        return template;
      }
    } else {
      return template;
    }
  }
};

const renderBadge = (node: TreeNode) => {
  if (typeof node.badge === 'number') {
    const limit = node.badgeLimit || 99;
    return <Badge style={node.badgeStyle}>{node.badge > limit ? `${limit}+` : node.badge}</Badge>;
  } else if (typeof node.badge === 'string') {
    const limit = node.badgeLimit || node.badge.length;
    return (
      <div className={styles.treenode_status} style={node.badgeStyle}>
        {node.badge.slice(0, limit)}
      </div>
    );
  }
};

const renderDescription = (node: any, replace: string) => {
  if (!isString(node.description) && !isUndefined(node.description)) {
    const Template = node.description as React.JSXElementConstructor<any>;
    return <Template />;
  } else if (!isUndefined(node.description)) {
    return (
      <div className={cls(styles.treenode_segment_grow, styles.treenode_description, node.descriptionClass)}>
        {renderWithRangeAndReplace(node.description, node.highLightRanges && node.highLightRanges.description, replace)}
      </div>
    );
  }
};

const renderFolderToggle = <T extends ExpandableTreeNode>(node: T, clickHandler: any) => {
  if (node.isLoading) {
    return <Loading />;
  }
  return (
    <div
      onClick={clickHandler}
      className={cls(styles.treenode_segment, styles.expansion_toggle, getIcon('arrow-right'), {
        [`${styles.mod_collapsed}`]: !node.expanded,
      })}
    />
  );
};

export const TreeContainerNode = ({
  node,
  leftPadding,
  defaultLeftPadding,
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
  draggable,
  foldable,
  isEdited,
  isComplex,
  actions = [],
  alwaysShowActions,
  commandActuator,
  replace = '',
  itemLineHeight,
  validate,
}: TreeNodeProps) => {
  defaultLeftPadding = typeof defaultLeftPadding === 'number' ? defaultLeftPadding : 10;
  const selectHandler = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (ExpandableTreeNode.is(node) && !foldable) {
      return;
    }
    if (isEdited) {
      return;
    }
    onSelect(node, event);
  };

  const twistieClickHandler = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (isEdited) {
      return;
    }
    onTwistieClick(node, event);
  };

  const contextMenuHandler = (event) => {
    event.stopPropagation();
    event.preventDefault();
    if (isEdited) {
      return;
    }
    onContextMenu(node, event);
  };

  const dragStartHandler = (event) => {
    event.stopPropagation();
    if (isEdited) {
      event.preventDefault();
      return;
    }
    onDragStart(node, event);
  };

  const dragEnterHandler = (event) => {
    if (isEdited) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    onDragEnter(node, event);
  };

  const dragOverHandler = (event) => {
    if (isEdited) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    onDragOver(node, event);
  };

  const dragLeaveHandler = (event) => {
    if (isEdited) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    onDragLeave(node, event);
  };

  const dragEndHandler = (event) => {
    if (isEdited) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    onDragEnd(node, event);
  };

  const dragHandler = (event) => {
    if (isEdited) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    onDrag(node, event);
  };

  const dropHandler = (event) => {
    if (isEdited) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    onDrop(node, event);
  };

  const FileTreeNodeWrapperStyle = {
    position: 'absolute',
    width: '100%',
    height: itemLineHeight,
    backgroundColor: node.background || 'inherit',
    left: '0',
    opacity: isEdited && !node.isTemporary ? 0.3 : 1,
    top: `${(node.order || 0) * itemLineHeight}px`,
  } as React.CSSProperties;

  const TreeNodeStyle = {
    paddingLeft: ExpandableTreeNode.is(node)
      ? `${defaultLeftPadding + (node.depth || 0) * (leftPadding || 0)}px`
      : `${defaultLeftPadding + (node.depth || 0) * (leftPadding || 0) + (isComplex ? 5 : 0)}px`,
    ...node.style,
    color: node.color,
    height: node.title ? itemLineHeight * 2 : itemLineHeight,
  } as React.CSSProperties;

  const renderTreeNodeActions = (node: TreeNode, actions: TreeViewAction[], commandActuator: CommandActuator) =>
    actions.map((action: TreeViewAction, index) => {
      if (isTreeViewActionComponent(action)) {
        return <span key={`${node.id}-${action.location}-${index}`}>{action.component}</span>;
      }

      const clickHandler = (event: React.MouseEvent) => {
        event.stopPropagation();
        event.preventDefault();
        const params = action.paramsKey
          ? typeof action.paramsKey === 'string'
            ? node[action.paramsKey]
            : action.paramsKey(node)
          : node.id;
        commandActuator(action.command, params);
      };
      const icon = typeof action.icon === 'string' ? action.icon : action.icon.dark;
      return (
        <Icon
          key={`${node.id}-${typeof action.paramsKey === 'string' ? node[action.paramsKey] : node.id}-${
            action.command
          }`}
          iconClass={cls(styles.action_icon, icon)}
          tooltip={action.title} // Icon 用 tooltip 当 title
          onClick={clickHandler}
        />
      );
    });

  const renderTreeNodeLeftActions = (node: TreeNode, actions: TreeViewAction[], commandActuator: any) => {
    if (actions.length === 0) {
      return;
    }
    return <div className={styles.left_actions}>{renderTreeNodeActions(node, actions, commandActuator)}</div>;
  };

  const renderTreeNodeRightActions = (node: TreeNode, actions: TreeViewAction[], commandActuator: any) => {
    if (actions.length === 0) {
      return;
    }
    return <div className={styles.right_actions}>{renderTreeNodeActions(node, actions, commandActuator)}</div>;
  };

  const renderTreeContainerActions = (node: TreeNode, actions: TreeViewAction[], commandActuator: any) => (
    <div className={styles.container_actions}>{renderTreeNodeActions(node, actions, commandActuator)}</div>
  );

  const renderHead = (node: TreeNode | ExpandableTreeNode) => {
    const treeNodeLeftActions: TreeViewAction[] = [];
    if (!ExpandableTreeNode.is(node)) {
      for (const action of actions) {
        switch (action.location) {
          case TreeViewActionTypes.TreeNode_Left:
            treeNodeLeftActions.push(action);
            break;
          default:
            break;
        }
      }
    }
    return (
      <div className={cls(styles.treenode_head)}>
        {node.headIconClass && <div className={cls(styles.treenode_head_icon, node.headIconClass)}></div>}
        {treeNodeLeftActions.length !== 0 && renderTreeNodeLeftActions(node, treeNodeLeftActions, commandActuator)}
      </div>
    );
  };

  const renderIcon = (node: TreeNode | ExpandableTreeNode) => (
    <div
      className={cls(node.icon, styles.file_icon, { expanded: node.expanded })}
      style={{ ...node.iconStyle, height: itemLineHeight, lineHeight: `${itemLineHeight}px` }}
    ></div>
  );

  const renderDisplayName = (
    node: TreeNode,
    actions: TreeViewAction[],
    commandActuator: any,
    onChange: any = () => {},
  ) => {
    const isComponent = !isString(node.name);
    const [value, setValue] = React.useState<string>(
      !isComponent && node.name === TEMP_FILE_NAME ? '' : isComponent ? '' : (node.name as string),
    );

    const changeHandler = (event) => {
      const newValue = event.target.value;
      setValue(newValue);
    };

    const blurHandler = (event) => {
      if (actualValidate(value)) {
        onChange(node, '');
      } else {
        onChange(node, value);
      }
    };

    const keydownHandler = (event: React.KeyboardEvent) => {
      const { key } = KeyCode.createKeyCode(event.nativeEvent);
      if (key && Key.ENTER.keyCode === key.keyCode) {
        event.stopPropagation();
        event.preventDefault();
        if (actualValidate(value)) {
          onChange(node, '');
        } else {
          onChange(node, value);
        }
      } else if (key && Key.ESCAPE.keyCode === key.keyCode) {
        event.stopPropagation();
        event.preventDefault();
        onChange(node, '');
      }
    };

    const actualValidate = (value: string) => {
      if (validate) {
        return validate(node, value);
      }
      return;
    };

    if (node.isTemporary) {
      let selection: InputSelection = {
        start: 0,
        end: 0,
      };
      if (node.name !== TEMP_FILE_NAME && isString(node.name)) {
        selection = {
          start: 0,
          end: node.name.replace(/\..+/, '').length,
        };
      }
      return (
        <div
          className={cls(
            styles.treenode_segment,
            styles.treenode_inputbox,
            actualValidate(value) && styles.overflow_visible,
          )}
        >
          <div className={styles.input_wrapper}>
            <ValidateInput
              type='text'
              className={cls(styles.input_box)}
              autoFocus={true}
              popup
              onBlur={blurHandler}
              value={value}
              onChange={changeHandler}
              onKeyDown={keydownHandler}
              validate={actualValidate}
              selection={selection}
            />
          </div>
        </div>
      );
    }
    if (isComponent) {
      const Template = node.name as React.JSXElementConstructor<any>;
      return <Template />;
    } else {
      return (
        <div className={cls(styles.treenode_segment, styles.treenode_displayname, node.labelClass)}>
          {node.beforeLabel}
          {renderWithRangeAndReplace(node.name, node.highLightRanges && node.highLightRanges.name, replace)}
          {node.afterLabel}
        </div>
      );
    }
  };

  const renderStatusTail = (node: TreeNode, actions: TreeViewAction[], commandActuator: any) => {
    const treeNodeRightActions: TreeViewAction[] = [];
    const treeContainerActions: TreeViewAction[] = [];
    for (const action of actions) {
      switch (action.location) {
        case TreeViewActionTypes.TreeNode_Right:
          treeNodeRightActions.push(action);
          break;
        case TreeViewActionTypes.TreeContainer:
          treeContainerActions.push(action);
          break;
        default:
          break;
      }
    }

    if (ExpandableTreeNode.is(node)) {
      if (treeContainerActions.length > 0) {
        return (
          <div className={cls(styles.treenode_segment, styles.treenode_tail)}>
            {renderTreeContainerActions(node, treeContainerActions, commandActuator)}
            {renderBadge(node)}
          </div>
        );
      } else {
        return <div className={cls(styles.treenode_segment, styles.treenode_tail)}>{renderBadge(node)}</div>;
      }
    } else if (treeNodeRightActions.length !== 0) {
      return (
        <div className={cls(styles.treenode_segment, styles.treenode_tail)}>
          {renderTreeNodeRightActions(node, treeNodeRightActions, commandActuator)}
          {renderBadge(node)}
        </div>
      );
    } else {
      return <div className={cls(styles.treenode_segment, styles.treenode_tail)}>{renderBadge(node)}</div>;
    }
  };

  const itemStyle = {
    height: itemLineHeight,
    lineHeight: `${itemLineHeight}px`,
    paddingLeft: ExpandableTreeNode.is(node) ? 0 : foldable && isComplex ? '15px' : 0,
  } as React.CSSProperties;

  const titleStyle = {
    height: itemLineHeight,
    lineHeight: `${itemLineHeight}px`,
    paddingLeft: ExpandableTreeNode.is(node) ? `${defaultLeftPadding + 8 + (leftPadding || 0)}px` : 0,
  } as React.CSSProperties;

  const renderTitle = (node: TreeNode) => {
    if (node.title) {
      return (
        <div className={styles.treenode_title} style={titleStyle}>
          {node.title}
        </div>
      );
    }
  };

  return (
    <div
      key={node.id}
      style={FileTreeNodeWrapperStyle}
      title={node.tooltip}
      draggable={draggable}
      onDragStart={dragStartHandler}
      onDragEnter={dragEnterHandler}
      onDragOver={dragOverHandler}
      onDragLeave={dragLeaveHandler}
      onDragEnd={dragEndHandler}
      onDrag={dragHandler}
      onDrop={dropHandler}
      onContextMenu={contextMenuHandler}
      onClick={selectHandler}
    >
      <div
        className={cls(styles.treenode, {
          [styles.alwaysShowActions]: alwaysShowActions || node.alwaysShowActions,
          [styles.mod_focused]: SelectableTreeNode.hasFocus(node),
          [styles.mod_selected]: !SelectableTreeNode.hasFocus(node) && !!SelectableTreeNode.isSelected(node),
        })}
        style={TreeNodeStyle}
      >
        {renderTitle(node)}
        <div className={cls(styles.treenode_content, node.badge ? styles.treenode_has_badge : '')} style={itemStyle}>
          {(ExpandableTreeNode.is(node) && foldable && renderFolderToggle(node, twistieClickHandler)) ||
            renderHead(node)}
          {renderIcon(node)}
          <div
            className={
              isEdited
                ? styles.treenode_edit_wrap
                : isString(node.name)
                ? styles.treenode_overflow_wrap
                : styles.treenode_flex_wrap
            }
          >
            {renderDisplayName(node, node.actions || actions, commandActuator, onChange)}
            {renderDescription(node, replace)}
          </div>
          {renderStatusTail(node, node.actions || actions, commandActuator)}
        </div>
      </div>
    </div>
  );
};
