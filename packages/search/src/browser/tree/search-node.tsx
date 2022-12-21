import cls from 'classnames';
import React, { useCallback } from 'react';

import { INodeRendererProps, ClasslistComposite, Badge, Button } from '@opensumi/ide-components';
import { getIcon, CommandService, SEARCH_COMMANDS, localize, getExternalIcon } from '@opensumi/ide-core-browser';

import { SearchContentNode, SearchFileNode } from './tree-node.defined';
import styles from './tree-node.module.less';

export interface ISearchNodeProps {
  item: any;
  search: string;
  replace: string;
  defaultLeftPadding?: number;
  leftPadding?: number;
  decorations?: ClasslistComposite;
  onClick: (ev: React.MouseEvent, item: SearchContentNode | SearchFileNode) => void;
  onDoubleClick: (ev: React.MouseEvent, item: SearchContentNode | SearchFileNode) => void;
  onContextMenu: (ev: React.MouseEvent, item: SearchContentNode | SearchFileNode) => void;
  commandService: CommandService;
}

export type ISearchNodeRenderedProps = ISearchNodeProps & INodeRendererProps;

export const SearchNodeRendered: React.FC<ISearchNodeRenderedProps> = ({
  item,
  search,
  replace,
  defaultLeftPadding = 8,
  leftPadding = 8,
  decorations,
  onClick,
  onDoubleClick,
  onContextMenu,
  commandService,
}: ISearchNodeRenderedProps) => {
  const handleClick = useCallback(
    (ev: React.MouseEvent) => {
      onClick(ev, item as SearchContentNode);
    },
    [onClick],
  );

  const handleDoubleClick = useCallback(
    (ev: React.MouseEvent) => {
      onDoubleClick(ev, item as SearchContentNode);
    },
    [onDoubleClick],
  );

  const handleContextMenu = useCallback(
    (ev: React.MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      onContextMenu(ev, item as SearchContentNode);
    },
    [onContextMenu],
  );

  const paddingLeft = `${
    defaultLeftPadding + (item.depth || 0) * (leftPadding || 0) + (!SearchFileNode.is(item) ? 8 : 0)
  }px`;

  const renderedNodeStyle = {
    height: SEARCH_TREE_NODE_HEIGHT,
    lineHeight: `${SEARCH_TREE_NODE_HEIGHT}px`,
    paddingLeft,
  } as React.CSSProperties;

  const renderIcon = useCallback((node: SearchFileNode | SearchContentNode) => {
    if (!SearchFileNode.is(node)) {
      return null;
    }
    return (
      <div
        className={cls(styles.icon, SearchFileNode.is(node) ? node.icon : '')}
        style={{
          height: SEARCH_TREE_NODE_HEIGHT,
          lineHeight: `${SEARCH_TREE_NODE_HEIGHT}px`,
        }}
      ></div>
    );
  }, []);

  const renderDisplayName = useCallback(
    (node: SearchFileNode | SearchContentNode) => (
      <div className={cls(styles.segment, styles.displayname)}>{node.displayName}</div>
    ),
    [],
  );

  const renderDescription = useCallback((node: SearchFileNode | SearchContentNode) => {
    if (SearchFileNode.is(node)) {
      return <div className={cls(styles.segment_grow, styles.description)}>{node.description}</div>;
    } else {
      const index = node.description.indexOf(search);
      if (index >= 0) {
        return (
          <div className={cls(styles.segment_grow, styles.description)}>
            {node.description.slice(0, index)}
            <span className={cls(styles.match, replace && styles.replace)}>{search}</span>
            {replace && <span className={styles.replace}>{replace}</span>}
            {node.description.slice(index + search.length)}
          </div>
        );
      }
      return <div className={cls(styles.segment_grow, styles.description)}>{node.description}</div>;
    }
  }, []);

  const renderStatusTail = useCallback(
    (node: SearchFileNode | SearchContentNode) => (
      <div className={cls(styles.segment, styles.tail)}>{renderBadge(node)}</div>
    ),
    [],
  );

  const renderBadge = useCallback((node: SearchFileNode | SearchContentNode) => {
    if (SearchFileNode.is(node)) {
      return <Badge className={styles.status}>{node.badge}</Badge>;
    }
  }, []);

  const renderFolderToggle = useCallback(
    (node: SearchFileNode) => (
      <div
        className={cls(styles.segment, styles.expansion_toggle, getIcon('arrow-right'), {
          [`${styles.mod_collapsed}`]: !(node as SearchFileNode).expanded,
        })}
      />
    ),
    [],
  );

  const renderTwice = useCallback((node: SearchFileNode | SearchContentNode) => {
    if (SearchFileNode.is(node)) {
      return renderFolderToggle(node);
    }
  }, []);

  const getItemTooltip = useCallback(() => item.tooltip, [item]);

  const renderActionBar = useCallback((node: SearchFileNode | SearchContentNode) => {
    let actions;
    if (SearchFileNode.is(item)) {
      actions = [
        {
          icon: getExternalIcon('replace-all'),
          title: localize('search.replace.title'),
          command: SEARCH_COMMANDS.MENU_REPLACE_ALL.id,
        },
        {
          icon: getIcon('eye-close'),
          title: localize('search.result.hide'),
          command: SEARCH_COMMANDS.MENU_HIDE.id,
        },
      ];
    } else {
      actions = [
        {
          icon: getExternalIcon('replace-all'),
          title: localize('search.replace.title'),
          command: SEARCH_COMMANDS.MENU_REPLACE.id,
        },
        {
          icon: getIcon('eye-close'),
          title: localize('search.result.hide'),
          command: SEARCH_COMMANDS.MENU_HIDE.id,
        },
      ];
    }

    return (
      <div
        className={styles.action_bar}
        style={{
          height: SEARCH_TREE_NODE_HEIGHT,
          lineHeight: `${SEARCH_TREE_NODE_HEIGHT}px`,
        }}
      >
        {actions.map((action) => {
          const clickHandler = (event: React.MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();
            commandService.executeCommand(action.command, node);
          };
          return (
            <Button
              type='icon'
              key={`${node.id}-${action.command}`}
              iconClass={cls(styles.action_icon, action.icon)}
              title={action.title}
              onClick={clickHandler}
            />
          );
        })}
      </div>
    );
  }, []);

  return (
    <div
      key={item.id}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      title={getItemTooltip()}
      className={cls(styles.search_node, decorations ? decorations.classlist : null)}
      style={renderedNodeStyle}
      data-id={item.id}
    >
      <div className={styles.content}>
        {renderTwice(item)}
        {renderIcon(item)}
        <div className={styles.overflow_wrap}>
          {renderDisplayName(item)}
          {renderDescription(item)}
        </div>
        {renderActionBar(item)}
        {renderStatusTail(item)}
      </div>
    </div>
  );
};

export const SEARCH_TREE_NODE_HEIGHT = 22;
