import cls from 'classnames';
import React from 'react';

import {
  Button,
  ClasslistComposite,
  CompositeTreeNode,
  INodeRendererProps,
  TreeNode,
  TreeNodeType,
} from '@opensumi/ide-components';
import {
  CommandService,
  OPEN_EDITORS_COMMANDS,
  URI,
  getIcon,
  localize,
  useDesignStyles,
} from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { EDITOR_WEBVIEW_SCHEME } from '@opensumi/ide-webview';

import { EditorFile, EditorFileGroup } from './opened-editor-node.define';
import styles from './opened-editor-node.module.less';
import { OpenedEditorDecorationService } from './services/opened-editor-decoration.service';

export interface IEditorNodeProps {
  item: any;
  defaultLeftPadding?: number;
  leftPadding?: number;
  decorationService: OpenedEditorDecorationService;
  commandService: CommandService;
  labelService: LabelService;
  decorations?: ClasslistComposite;
  onClick: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType, activeUri?: URI) => void;
  onContextMenu: (
    ev: React.MouseEvent,
    item: TreeNode | CompositeTreeNode,
    type: TreeNodeType,
    activeUri?: URI,
  ) => void;
}

export type EditorNodeRenderedProps = IEditorNodeProps & INodeRendererProps;

export const EditorTreeNode: React.FC<EditorNodeRenderedProps> = ({
  item,
  defaultLeftPadding = 8,
  leftPadding = 8,
  onClick,
  onContextMenu,
  itemType,
  decorationService,
  labelService,
  commandService,
  decorations,
}: EditorNodeRenderedProps) => {
  const decoration = EditorFileGroup.is(item) ? null : decorationService.getDecoration(item.uri, false);
  const styles_opened_editor_node = useDesignStyles(styles.opened_editor_node, 'opened_editor_node');
  const styles_opened_editor_node_overflow_wrap = useDesignStyles(
    styles.opened_editor_node_overflow_wrap,
    'opened_editor_node_overflow_wrap',
  );

  const handleClick = (ev: React.MouseEvent) => {
    if (itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      onClick(ev, item as EditorFile, itemType);
    }
  };

  const handleContextMenu = (ev: React.MouseEvent) => {
    if (ev.nativeEvent.which === 0) {
      return;
    }
    if (itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      onContextMenu(ev, item as TreeNode, itemType);
    }
  };

  const paddingLeft = `${
    defaultLeftPadding +
    (item.depth || 0) * (leftPadding || 0) +
    (!EditorFileGroup.is(item) && !EditorFileGroup.isRoot(item.parent) ? 18 : 0)
  }px`;

  const editorNodeStyle = {
    color: decoration ? decoration.color : '',
    height: OPENED_EDITOR_TREE_NODE_HEIGHT,
    lineHeight: `${OPENED_EDITOR_TREE_NODE_HEIGHT}px`,
    paddingLeft,
  } as React.CSSProperties;

  const renderIcon = (node: EditorFileGroup | EditorFile) => {
    if (EditorFileGroup.is(node)) {
      return null;
    }
    const iconClass = node.resource.icon || labelService.getIcon((node as EditorFile).uri, { isDirectory: false });
    return (
      <div
        className={cls(styles.file_icon, iconClass)}
        style={{ height: OPENED_EDITOR_TREE_NODE_HEIGHT, lineHeight: `${OPENED_EDITOR_TREE_NODE_HEIGHT}px` }}
      ></div>
    );
  };

  const getNodeName = (node: EditorFileGroup | EditorFile) => {
    if (!EditorFileGroup.is(node)) {
      if (node.uri.scheme === EDITOR_WEBVIEW_SCHEME) {
        return node.displayName;
      }

      return node.displayName || labelService.getName(node.uri);
    }

    return node.displayName;
  };

  const renderDisplayName = (node: EditorFileGroup | EditorFile) => (
    <div className={cls(styles.opened_editor_node_segment, styles.opened_editor_node_displayname)}>
      {getNodeName(node)}
    </div>
  );

  const renderDescription = (node: EditorFileGroup | EditorFile) => {
    if (EditorFileGroup.is(node) || (EditorFile.is(node) && node.tooltip === getNodeName(node))) {
      return null;
    }
    return (
      <div className={cls(styles.opened_editor_node_segment_grow, styles.opened_editor_node_description)}>
        {node.tooltip}
      </div>
    );
  };

  const renderStatusTail = () => (
    <div className={cls(styles.opened_editor_node_segment, styles.opened_editor_node_tail)}>{renderBadge()}</div>
  );

  const renderBadge = () => {
    if (!decoration) {
      return null;
    }
    return <div className={styles.opened_editor_node_status}>{decoration.badge.slice()}</div>;
  };

  const getItemTooltip = () => {
    let tooltip = item.tooltip;
    if (decoration && decoration.badge) {
      tooltip += ` • ${decoration.tooltip}`;
    }
    return tooltip;
  };

  const renderAction = () => {
    let actions: any[] = [];
    if (EditorFileGroup.is(item)) {
      actions = [
        {
          icon: getIcon('save-all'),
          title: localize('opened.editors.save.byGroup'),
          command: OPEN_EDITORS_COMMANDS.SAVE_BY_GROUP.id,
        },
        {
          icon: getIcon('clear'),
          title: localize('opened.editors.close.byGroup'),
          command: OPEN_EDITORS_COMMANDS.CLOSE_BY_GROUP.id,
        },
      ];
      return (
        <div className={styles.opened_editor_right_actions}>
          {actions.map((action) => {
            const clickHandler = (event: React.MouseEvent) => {
              event.stopPropagation();
              event.preventDefault();
              commandService.executeCommand(action.command, item);
            };
            return (
              <Button
                type='icon'
                key={`${item.id}-${action.command}`}
                iconClass={cls(styles.action_icon, action.icon)}
                title={action.title}
                onClick={clickHandler}
              />
            );
          })}
        </div>
      );
    } else {
      actions = [
        {
          icon: getIcon('window-close'),
          title: localize('file.close'),
          command: OPEN_EDITORS_COMMANDS.CLOSE.id,
        },
      ];
      return (
        <div className={styles.opened_editor_left_actions}>
          {actions.map((action) => {
            const clickHandler = (event: React.MouseEvent) => {
              event.stopPropagation();
              event.preventDefault();
              commandService.executeCommand(action.command, item);
            };
            return (
              <Button
                type='icon'
                key={`${item.id}-${action.command}`}
                iconClass={cls(styles.action_icon, action.icon)}
                title={action.title}
                onClick={clickHandler}
              />
            );
          })}
        </div>
      );
    }
  };

  const renderActionBar = () => <div className={styles.opened_editor_action_bar}>{renderAction()}</div>;
  return (
    <div
      key={item.id}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={getItemTooltip()}
      className={cls(
        styles_opened_editor_node,
        decorations ? decorations.classlist : null,
        EditorFile.is(item) && item.dirty && styles.dirty,
      )}
      style={editorNodeStyle}
      data-id={item.id}
    >
      {renderActionBar()}
      <div className={cls(styles.opened_editor_node_content)}>
        {renderIcon(item)}
        <div className={styles_opened_editor_node_overflow_wrap}>
          {renderDisplayName(item)}
          {renderDescription(item)}
        </div>
        {renderStatusTail()}
      </div>
    </div>
  );
};

export const OPENED_EDITOR_TREE_NODE_HEIGHT = 22;
export const OPENED_EDITOR_BADGE_LIMIT = 99;
