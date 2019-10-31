import * as React from 'react';
import * as styles from './tree.module.less';
import * as cls from 'classnames';
import { TreeViewAction, isTreeViewActionComponent, isUndefined } from '@ali/ide-core-common';
import { TreeNode, TreeViewActionTypes, ExpandableTreeNode, SelectableTreeNode, TreeNodeHighlightRange } from './';
import { TEMP_FILE_NAME } from './tree.view';
import { getIcon } from '../../icon';
import Icon from '../icon';
import Badge from '../badge';
import { ValidateInput } from '../input';
import { KeyCode, Key } from '../../keyboard';

export type CommandActuator<T = any> = (commandId: string, params: T) => void;

export interface TreeNodeProps extends React.PropsWithChildren<any> {
  node: TreeNode;
  leftPadding?: number;
  onSelect?: any;
  onTwistieClick?: any;
  onContextMenu?: any;
  onDragStart?: any;
  onDragEnter?: any;
  onDragOver?: any;
  onDragLeave?: any;
  onDrag?: any;
  validate?: any;
  draggable?: boolean;
  isEdited?: boolean;
  actions?: TreeViewAction[];
  replace?: string;
  commandActuator?: CommandActuator;
}

const renderDescriptionWithRangeAndReplace = (description: string, range?: TreeNodeHighlightRange, replace?: string) => {
  if (isUndefined(description)) {
    return '';
  }
  if (range) {
    return <span>
      {description.slice(0, range.start)}
      <span className={cls(styles.kt_search_match, replace && styles.replace)}>
        {description.slice(range.start, range.end)}
      </span>
      <span className={replace && styles.kt_search_replace}>
        {replace}
      </span>
      {description.slice(range.end)}

    </span>;
  } else {
    return description;
  }
};

const renderName = (name: string = 'UNKNOW') => {
  if (name === 'UNKNOW') {
    return 'UNKNOW';
  }
  return name;
};

const renderBadge = (node: TreeNode) => {
  if (typeof node.badge === 'number') {
    return <Badge style={node.badgeStyle}>{node.badge > 99 ? '99+' : node.badge}</Badge>;
  } else if (typeof node.badge === 'string') {
    return <div className={styles.kt_treenode_status} style={node.badgeStyle}>
      {node.badge}
    </div>;
  }
};

const renderDescription = (node: any, replace: string) => {
  return <div className={cls(styles.kt_treenode_segment_grow, styles.kt_treenode_description, node.descriptionClass)}>
    {renderDescriptionWithRangeAndReplace(node.description || '', node.highLightRange, replace)}
  </div>;
};

const renderFolderToggle = <T extends ExpandableTreeNode>(node: T, clickHandler: any) => {
  return <div
    onClick={clickHandler}
    className={cls(
      styles.kt_treenode_segment,
      styles.kt_expansion_toggle,
      getIcon('right'),
      { [`${styles.kt_mod_collapsed}`]: !node.expanded },
    )}
  >
  </div>;
};

const renderHead = (node: TreeNode) => {
  return <div
    className={cls(
      styles.kt_treenode_head,
      node.headClass,
    )}
  >
  </div>;
};

export const TreeContainerNode = (
  {
    node,
    leftPadding,
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
    actions = [],
    alwaysShowActions,
    commandActuator,
    replace = '',
    itemLineHeight,
    validate,
  }: TreeNodeProps,
) => {

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
    left: '0',
    opacity: isEdited && !node.isTemporary ? .3 : 1,
    top: `${(node.order || 0) * itemLineHeight}px`,
  } as React.CSSProperties;

  const TreeNodeStyle = {
    paddingLeft: `${10 + (node.depth || 0) * (leftPadding || 0)}px`,
    ...node.style,
    color: node.color,
    height: node.title ? itemLineHeight * 2 : itemLineHeight,
  } as React.CSSProperties;

  const renderTreeNodeActions = (node: TreeNode, actions: TreeViewAction[], commandActuator: CommandActuator) => {
    return actions.map((action: TreeViewAction, index) => {
      if (isTreeViewActionComponent(action)) {
        return <span key={`${action.location}-${index}`}>{action.component}</span>;
      }

      const clickHandler = (event: React.MouseEvent) => {
        event.stopPropagation();
        event.preventDefault();
        commandActuator(action.command, action.paramsKey ? node[action.paramsKey] : node.uri);
      };
      const icon = typeof action.icon === 'string' ? action.icon : action.icon.dark;
      return <Icon
        key={`${action.paramsKey ? node[action.paramsKey] : node.uri}-${action.command}`}
        iconClass={cls(styles.action_icon, icon)}
        title={action.title}
        onClick={clickHandler} />;
    });
  };

  const renderTreeNodeLeftActions = (node: TreeNode, actions: TreeViewAction[], commandActuator: any) => {
    if (actions.length === 0) {
      return;
    }
    return <div className={styles.left_actions}>
      {renderTreeNodeActions(node, actions, commandActuator)}
    </div>;

  };

  const renderTreeNodeRightActions = (node: TreeNode, actions: TreeViewAction[], commandActuator: any) => {
    if (actions.length === 0) {
      return;
    }
    return <div className={styles.right_actions}>
      {renderTreeNodeActions(node, actions, commandActuator)}
    </div>;

  };

  const renderTreeContainerActions = (node: TreeNode, actions: TreeViewAction[], commandActuator: any) => {
    return <div className={styles.container_actions}>
      {renderTreeNodeActions(node, actions, commandActuator)}
    </div>;

  };

  const renderIcon = (node: TreeNode) => {
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
    return <div className={cls(node.icon, styles.kt_file_icon)}>
      {treeNodeLeftActions.length !== 0 && renderTreeNodeLeftActions(node, treeNodeLeftActions, commandActuator)}
    </div>;
  };

  const renderDisplayName = (node: TreeNode, actions: TreeViewAction[], commandActuator: any, onChange: any = () => { }) => {
    const [value, setValue] = React.useState(node.uri ? node.uri.displayName === TEMP_FILE_NAME ? '' : node.uri.displayName : node.name === TEMP_FILE_NAME ? '' : node.name);

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
      return validate(node, value);
    };

    if (node.isTemporary) {
      return <div
        className={cls(styles.kt_treenode_segment, styles.kt_treenode_segment_grow, actualValidate(value) && styles.overflow_visible)}
      >
        <div className={styles.kt_input_wrapper}>
          <ValidateInput
            type='text'
            className={cls(styles.kt_input_box)}
            autoFocus={true}
            onBlur={blurHandler}
            value={value}
            onChange={changeHandler}
            onKeyDown={keydownHandler}
            validate={actualValidate}
          />
        </div>
      </div>;
    }
    return <div
      className={cls(styles.kt_treenode_segment, node.description ? styles.kt_treenode_displayname : styles.kt_treenode_segment_grow, node.labelClass)}
    >
      {node.beforeLabel}
      {renderName(node.name)}
      {node.afterLabel}
    </div>;
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
        return <div className={cls(styles.kt_treenode_segment, styles.kt_treenode_tail)}>
          {renderTreeContainerActions(node, treeContainerActions, commandActuator)}
          {renderBadge(node)}
        </div>;
      }
    } else if (treeNodeRightActions.length !== 0) {
      return <div className={cls(styles.kt_treenode_segment, styles.kt_treenode_tail)}>
        {renderTreeNodeRightActions(node, treeNodeRightActions, commandActuator)}
        {renderBadge(node)}
      </div>;
    } else {
      return <div className={cls(styles.kt_treenode_segment, styles.kt_treenode_tail)}>
        {
          renderBadge(node)
        }
      </div>;
    }
  };

  const itemStyle = {
    height: itemLineHeight,
    lineHeight: `${itemLineHeight}px`,
  } as React.CSSProperties;

  const titleStyle = {
    height: itemLineHeight,
    lineHeight: `${itemLineHeight}px`,
    paddingLeft: ExpandableTreeNode.is(node) ? `${10 + (leftPadding || 0)}px` : 0,
  } as React.CSSProperties;

  const renderTitle = (node: TreeNode) => {
    if (node.title) {
      return <div className={styles.kt_treenode_title} style={titleStyle}>{node.title}</div>;
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
        className={cls(
          styles.kt_treenode,
          {
            [styles.alwaysShowActions]: alwaysShowActions,
            [styles.kt_mod_focused]: SelectableTreeNode.hasFocus(node),
            [styles.kt_mod_selected]: !SelectableTreeNode.hasFocus(node) && !!SelectableTreeNode.isSelected(node),
          },
        )}
        style={TreeNodeStyle}
      >
        {renderTitle(node)}
        <div className={cls(styles.kt_treenode_content, node.badge ? styles.kt_treenode_has_badge : '')} style={itemStyle}>
          {(ExpandableTreeNode.is(node) && foldable && renderFolderToggle(node, twistieClickHandler)) || (node.headClass && renderHead(node))}
          {renderIcon(node)}
          {renderDisplayName(node, node.actions || actions, commandActuator, onChange)}
          {renderDescription(node, replace)}
          {renderStatusTail(node, node.actions || actions, commandActuator)}
        </div>
      </div>
    </div>
  );
};
