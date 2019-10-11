import * as React from 'react';
import * as styles from './tree.module.less';
import * as cls from 'classnames';
import { trim, rtrim, localize, formatLocalize, coalesce, isValidBasename, TreeViewAction, isTreeViewActionComponent } from '@ali/ide-core-common';
import { TreeNode, TreeViewActionConfig, TreeViewActionTypes, ExpandableTreeNode, SelectableTreeNode, TreeNodeHighlightRange } from './';
import { TEMP_FILE_NAME } from './tree.view';
import { getIcon } from '../../icon';
import Icon from '../icon';
import { Input } from '../input';

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
  draggable?: boolean;
  isEdited?: boolean;
  actions?: TreeViewAction[];
  replace?: string;
  commandActuator?: CommandActuator;
}

const trimLongName = (name: string): string => {
  if (name && name.length > 255) {
    return `${name.substr(0, 255)}...`;
  }

  return name;
};

const renderIcon = (node: TreeNode) => {
  return <div className={ cls(node.icon, styles.kt_file_icon) }></div>;
};

const renderDescriptionWithRangeAndReplace = (description: string = 'UNKNOW', range?: TreeNodeHighlightRange, replace?: string) => {
  if (description === 'UNKNOW') {
    return 'UNKNOW';
  }
  if (range) {
    return <div>
      { description.slice(0, range.start) }
      <span className={ cls(styles.kt_search_match, replace && styles.replace) }>
        { description.slice(range.start, range.end) }
      </span>
      <span className={ replace && styles.kt_search_replace }>
        { replace }
      </span>
      { description.slice(range.end) }

    </div>;
  } else {
    return name;
  }
};

const renderName = (name: string = 'UNKNOW') => {
  if (name === 'UNKNOW') {
    return 'UNKNOW';
  }
  return name;
};

const getWellFormedFileName = (filename: string): string => {
  if (!filename) {
    return filename;
  }

  // 去除空格
  filename = trim(filename, '\t');

  // 移除尾部的 . / \\
  filename = rtrim(filename, '.');
  filename = rtrim(filename, '/');
  filename = rtrim(filename, '\\');

  return filename;
};

const validateFileName = (item: TreeNode, name: string): string | null => {
  // 转换为合适的名称
  name = getWellFormedFileName(name);

  // 不存在文件名称
  if (!name || name.length === 0 || /^\s+$/.test(name)) {
    return localize('validate.tree.emptyFileNameError');
  }

  // 不允许开头为分隔符的名称
  if (name[0] === '/' || name[0] === '\\') {
    return localize('validate.tree.fileNameStartsWithSlashError');
  }

  const names = coalesce(name.split(/[\\/]/));
  const parent = item.parent;
  if (name !== item.name) {
    if (parent) {
      // 不允许覆盖已存在的文件
      const child = parent.children.find((child) => child.name === name);
      if (child) {
        return formatLocalize('validate.tree.fileNameExistsError', name);
      }
    }

  }
  // 判断子路径是否合法
  if (names.some((folderName) => !isValidBasename(folderName))) {
    return formatLocalize('validate.tree.invalidFileNameError', trimLongName(name));
  }

  return null;
};

const renderBadge = (node: TreeNode) => {
  if (typeof node.badge === 'number') {
    return <div className={styles.kt_treenode_count} style={node.badgeStyle}>
      {node.badge > 99 ? '99+' : node.badge}
    </div>;
  } else if (typeof node.badge === 'string') {
    return <div className={styles.kt_treenode_status} style={node.badgeStyle}>
      {node.badge}
    </div>;
  }
};

const renderStatusTail = (node: TreeNode) => {
  return <div className={ cls(styles.kt_treenode_segment, styles.kt_treenode_tail) }>
    {
      renderBadge(node)
    }
  </div>;
};

const renderDescription = (node: any, replace: string) => {
  return <div className={ cls(styles.kt_treenode_segment_grow, styles.kt_treenode_description, node.descriptionClass) }>
    { renderDescriptionWithRangeAndReplace(node.description || '', node.highLightRange, replace) }
  </div>;
};

const renderFolderToggle = <T extends ExpandableTreeNode>(node: T, clickHandler: any) => {
  return <div
    onClick={ clickHandler }
    className={ cls(
      styles.kt_treenode_segment,
      styles.kt_expansion_toggle,
      getIcon('right'),
      {[`${styles.kt_mod_collapsed}`]: !node.expanded},
    )}
  >
  </div>;
};

const renderHead = (node: TreeNode) => {
  return <div
    className={ cls(
      styles.kt_treenode_head,
      node.headClass,
    )}
  >
  </div>;
};

const renderDisplayName = (node: TreeNode, onChange: any) => {
  const [value, setValue] = React.useState(node.uri ? node.uri.displayName === TEMP_FILE_NAME ? '' : node.uri.displayName : node.name);
  const [validateMessage, setValidateMessage] = React.useState<string>('');

  const changeHandler = (event) => {
    const newValue =  event.target.value;
    setValue(newValue);
    if (!newValue) {
      setValidateMessage('');
      return;
    }
    const message = validateFileName(node, newValue);
    if (message && message !== validateMessage) {
      setValidateMessage(message);
    } else {
      setValidateMessage('');
    }
  };

  const blurHandler = (event) => {
    if (validateMessage) {
      onChange(node, '');
    } else {
      onChange(node, value);
    }
  };

  const keydownHandler = (event: React.KeyboardEvent) => {
    if (event.keyCode === 13) {
      event.stopPropagation();
      event.preventDefault();
      if (validateMessage) {
        onChange(node, '');
      } else {
        onChange(node, value);
      }
    }
  };

  const renderValidateMessage = (message: string) => {
    return message && <div className={ cls(styles.kt_validate_message, styles.error) }>
      { message }
    </div>;
  };

  if (node.filestat && node.filestat.isTemporaryFile) {
    return <div
      className={ cls(styles.kt_treenode_segment, styles.kt_treenode_segment_grow, validateMessage && styles.overflow_visible) }
    >
      <div className={ styles.kt_input_wrapper }>
        <Input
          type='text'
          insertClass={ cls(styles.kt_input_box, validateMessage && styles.error) }
          autoFocus={ true }
          onBlur = { blurHandler }
          value = { value }
          onChange = { changeHandler}
          onKeyDown = { keydownHandler }
          />
          {
            renderValidateMessage(validateMessage)
          }
      </div>
    </div>;
  }
  return <div
    className={ cls(styles.kt_treenode_segment, node.description ? styles.kt_treenode_displayname : styles.kt_treenode_segment_grow, node.labelClass) }
  >
    { node.beforeLabel }
    { renderName(node.name) }
    { node.afterLabel }
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
  }: TreeNodeProps,
) => {

  const selectHandler = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (ExpandableTreeNode.is(node) && !foldable) {
      return;
    }
    if (isEdited) {
      return ;
    }
    onSelect(node, event);
  };

  const twistieClickHandler = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (isEdited) {
      return ;
    }
    onTwistieClick(node, event);
  };

  const contextMenuHandler = (event) => {
    event.stopPropagation();
    event.preventDefault();
    if (isEdited) {
      return ;
    }
    onContextMenu(node, event);
  };

  const dragStartHandler = (event) => {
    event.stopPropagation();
    if (isEdited) {
      event.preventDefault();
      return ;
    }
    onDragStart(node, event);
  };

  const dragEnterHandler = (event) => {
    if (isEdited) {
      event.stopPropagation();
      event.preventDefault();
      return ;
    }
    onDragEnter(node, event);
  };

  const dragOverHandler = (event) => {
    if (isEdited) {
      event.stopPropagation();
      event.preventDefault();
      return ;
    }
    onDragOver(node, event);
  };

  const dragLeaveHandler = (event) => {
    if (isEdited) {
      event.stopPropagation();
      event.preventDefault();
      return ;
    }
    onDragLeave(node, event);
  };

  const dragEndHandler = (event) => {
    if (isEdited) {
      event.stopPropagation();
      event.preventDefault();
      return ;
    }
    onDragEnd(node, event);
  };

  const dragHandler = (event) => {
    if (isEdited) {
      event.stopPropagation();
      event.preventDefault();
      return ;
    }
    onDrag(node, event);
  };

  const dropHandler = (event) => {
    if (isEdited) {
      event.stopPropagation();
      event.preventDefault();
      return ;
    }
    onDrop(node, event);
  };

  const FileTreeNodeWrapperStyle = {
    position: 'absolute',
    width: '100%',
    height: itemLineHeight,
    left: '0',
    opacity: isEdited && !node.filestat.isTemporaryFile ? .3 : 1,
    top: `${(node.order || 0) * itemLineHeight}px`,
  } as React.CSSProperties;

  const TreeNodeStyle = {
    paddingLeft: `${10 + (node.depth || 0) * (leftPadding || 0) }px`,
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
        key={ action.title || index }
        iconClass={ icon }
        title={ action.title }
        onClick={ clickHandler } />;
    });
  };

  const renderTreeNodeLeftActions = (node: TreeNode, actions: TreeViewAction[], commandActuator: any) => {
    if (actions.length === 0) {
      return;
    }
    return <div className={styles.left_actions}>
      { renderTreeNodeActions(node, actions, commandActuator) }
    </div>;

  };

  const renderTreeNodeRightActions = (node: TreeNode, actions: TreeViewAction[], commandActuator: any) => {
    if (actions.length === 0) {
      return;
    }
    return <div className={styles.right_actions}>
      { renderTreeNodeActions(node, actions, commandActuator) }
    </div>;

  };

  const renderTreeContainerActions = (node: TreeNode, actions: TreeViewAction[], commandActuator: any) => {
    return <div className={styles.container_actions}>
      { renderTreeNodeActions(node, actions, commandActuator) }
    </div>;

  };

  const renderActionBar = (node: TreeNode, actions: TreeViewAction[], commandActuator: any) => {
    const treeNodeLeftActions: TreeViewAction[] = [];
    const treeNodeRightActions: TreeViewAction[] = [];
    const treeContainerActions: TreeViewAction[] = [];
    for (const action of actions) {
      switch (action.location) {
        case TreeViewActionTypes.TreeNode_Left:
          treeNodeLeftActions.push(action);
          break;
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
        return <div className={cls(styles.kt_treenode_action_bar)}>
          { renderTreeContainerActions(node, treeContainerActions, commandActuator) }
        </div>;
      }
    } else if (treeNodeLeftActions.length !== 0 || treeNodeRightActions.length !== 0) {
      return <div className={cls(styles.kt_treenode_action_bar)}>
        { renderTreeNodeLeftActions(node, treeNodeLeftActions, commandActuator) }
        { renderTreeNodeRightActions(node, treeNodeRightActions, commandActuator) }
      </div>;
    }
    return null;
  };

  const itemStyle = {
    height: itemLineHeight,
  } as React.CSSProperties;

  const renderTitle = (node: TreeNode) => {
    if (node.title) {
      return <div className={styles.kt_treenode_title} style={itemStyle}>{node.title}</div>;
    }
  };

  return (
    <div
      key={ node.id }
      style={ FileTreeNodeWrapperStyle }
      title = { node.tooltip }
      draggable={ draggable }
      onDragStart={ dragStartHandler }
      onDragEnter={ dragEnterHandler }
      onDragOver={ dragOverHandler }
      onDragLeave={ dragLeaveHandler }
      onDragEnd={ dragEndHandler }
      onDrag={ dragHandler }
      onDrop={ dropHandler }
      onContextMenu={ contextMenuHandler }
      onClick={ selectHandler }
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
        style={ TreeNodeStyle }
      >
        { renderTitle(node) }
        <div className={ cls(styles.kt_treenode_content, node.badge ? styles.kt_treenode_has_badge : '')}  style={ itemStyle }>
          { renderActionBar(node, node.actions || actions, commandActuator) }
          { (ExpandableTreeNode.is(node) && foldable && renderFolderToggle(node, twistieClickHandler)) || (node.headClass && renderHead(node))}
          { renderIcon(node) }
          { renderDisplayName(node, onChange) }
          { renderDescription(node, replace) }
          { renderStatusTail(node) }
        </div>
      </div>
    </div>
  );
};
