import cls from 'classnames';
import React, { CSSProperties, FC, MouseEvent, ReactNode, useCallback, useEffect, useState, DragEvent } from 'react';

import { INodeRendererProps, ClasslistComposite, PromptHandle, TreeNodeType } from '@opensumi/ide-components';
import { Loading } from '@opensumi/ide-components';
import { getIcon } from '@opensumi/ide-core-browser';
import { TitleActionList } from '@opensumi/ide-core-browser/lib/components/actions';
import { MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { transformLabelWithCodicon } from '@opensumi/ide-core-browser/lib/utils/label';
import { IDecorationsService } from '@opensumi/ide-decoration/lib/common/decorations';
import { IIconService, IThemeService } from '@opensumi/ide-theme/lib/common/theme.service';

import styles from '../vscode/api/tree-view/tree-view-node.module.less';
import { ExtensionTreeNode, ExtensionCompositeTreeNode } from '../vscode/api/tree-view/tree-view.node.defined';

export interface ITreeViewNodeProps {
  item: ExtensionTreeNode | ExtensionCompositeTreeNode;
  treeViewId: string;
  defaultLeftPadding?: number;
  leftPadding?: number;
  decorations?: ClasslistComposite;
  onTwistierClick?: (ev: MouseEvent, item: ExtensionTreeNode | ExtensionCompositeTreeNode, type: TreeNodeType) => void;
  onClick: (ev: MouseEvent, item: ExtensionTreeNode | ExtensionCompositeTreeNode, type: TreeNodeType) => void;
  onContextMenu?: (ev: MouseEvent, item: ExtensionTreeNode | ExtensionCompositeTreeNode, type: TreeNodeType) => void;
  onDragStart?: (ev: MouseEvent, item: ExtensionTreeNode | ExtensionCompositeTreeNode) => void;
  onDragEnter?: (ev: MouseEvent, item: ExtensionTreeNode | ExtensionCompositeTreeNode) => void;
  onDrop?: (ev: MouseEvent, item: ExtensionTreeNode | ExtensionCompositeTreeNode) => void;
  onDragOver?: (ev: MouseEvent, item: ExtensionTreeNode | ExtensionCompositeTreeNode) => void;
  onDragLeave?: (ev: MouseEvent, item: ExtensionTreeNode | ExtensionCompositeTreeNode) => void;
  decorationService: IDecorationsService;
  draggable: boolean;
}

export type TreeViewNodeRenderedProps = ITreeViewNodeProps & INodeRendererProps;

export const TreeViewNode: FC<TreeViewNodeRenderedProps> = ({
  item,
  onClick,
  onContextMenu,
  itemType,
  leftPadding = 8,
  onTwistierClick,
  decorations,
  defaultLeftPadding = 8,
  treeViewId,
  decorationService,
  draggable,
  onDragStart,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}: TreeViewNodeRenderedProps) => {
  const iconService = useInjectable<IIconService>(IIconService);
  const [decoration, setDecoration] = useState(item.uri && decorationService.getDecoration(item.uri, false));

  useEffect(() => {
    const disposable = decorationService.onDidChangeDecorations((e) => {
      if (item.uri && e.affectsResource(item.uri)) {
        setDecoration(decorationService.getDecoration(item.uri, false));
      }
    });
    return () => {
      disposable.dispose();
    };
  }, []);

  const themeService = useInjectable<IThemeService>(IThemeService);

  const handleClick = useCallback(
    (ev: MouseEvent) => {
      if (itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
        onClick(ev, item, itemType);
      }
    },
    [item, itemType, onClick],
  );

  const handlerTwistierClick = useCallback(
    (ev: MouseEvent) => {
      if (itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
        if (onTwistierClick) {
          onTwistierClick(ev, item, itemType);
        } else {
          onClick(ev, item, itemType);
        }
      }
    },
    [itemType, onTwistierClick, onClick],
  );

  const handleContextMenu = useCallback(
    (ev: MouseEvent) => {
      if (ev.nativeEvent.which === 0 || !onContextMenu) {
        return;
      }
      if (itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
        onContextMenu(ev, item, itemType);
      }
    },
    [item, itemType, onContextMenu],
  );

  const handleDragStart = useCallback(
    (event: DragEvent) => {
      onDragStart && onDragStart(event, item);
    },
    [item, onDragStart],
  );

  const handleDragEnter = useCallback(
    (event: DragEvent) => {
      onDragEnter && onDragEnter(event, item);
    },
    [item, onDragEnter],
  );

  const handleDragLeave = useCallback(
    (event: DragEvent) => {
      onDragLeave && onDragLeave(event, item);
    },
    [item, onDragLeave],
  );

  const handleDragOver = useCallback(
    (event: DragEvent) => {
      onDragOver && onDragOver(event, item);
    },
    [item, onDragOver],
  );

  const handleDrop = useCallback(
    (event: DragEvent) => {
      onDrop && onDrop(event, item);
    },
    [item, onDrop],
  );

  const isDirectory = itemType === TreeNodeType.CompositeTreeNode;
  const paddingLeft = isDirectory
    ? `${defaultLeftPadding + (item.depth || 0) * (leftPadding || 0)}px`
    : `${defaultLeftPadding + (item.depth || 0) * (leftPadding || 0) + 8}px`;

  const fileTreeNodeStyle = {
    height: TREE_VIEW_NODE_HEIGHT,
    lineHeight: `${TREE_VIEW_NODE_HEIGHT}px`,
    paddingLeft,
  } as CSSProperties;

  const renderFolderToggle = (node: ExtensionCompositeTreeNode | PromptHandle, clickHandler: any) => {
    if (decorations && decorations?.classlist.indexOf(styles.mod_loading) > -1) {
      return <Loading />;
    }
    return (
      <div
        onClick={clickHandler}
        className={cls(styles.tree_view_node_segment, styles.expansion_toggle, getIcon('arrow-right'), {
          [`${styles.mod_collapsed}`]: !(node as ExtensionCompositeTreeNode).expanded,
        })}
      />
    );
  };

  const renderIcon = (node: ExtensionCompositeTreeNode | ExtensionTreeNode) => (
    <div className={cls(styles.file_icon, node.icon)} style={{ maxHeight: TREE_VIEW_NODE_HEIGHT }}></div>
  );

  const renderDisplayName = (node: ExtensionCompositeTreeNode | ExtensionTreeNode) => {
    const displayName = () => {
      if (node.highlights) {
        let hightlightSnaps: ReactNode[] = [];
        let endIndex = 0;
        const hightlights = node.highlights.sort((a, b) => a[0] - b[0]);
        hightlightSnaps = hightlights.map((highlight, index: number) => {
          const [start, end] = highlight;
          const addonStr = node.displayName.slice(endIndex, start);
          endIndex = end;
          const highlightStr = node.displayName.slice(start, end);
          const hls = [
            <span key={`line_begin_${index}_${addonStr}`}>{addonStr}</span>,
            <span className={styles.highlight} key={`line_hightlight_${index}_${highlightStr}`}>
              {highlightStr}
            </span>,
          ];
          if (index === hightlights.length - 1) {
            const leftStr = node.displayName.slice(end);
            hls.push(<span key={`line_end_${index}_${leftStr}`}>{leftStr}</span>);
          }
          return hls;
        });
        return hightlightSnaps;
      } else {
        return node.displayName;
      }
    };
    return (
      <div
        className={cls(
          styles.tree_view_node_segment,
          styles.tree_view_node_displayname,
          node.strikethrough && styles.strikethrough,
        )}
      >
        {displayName()}
      </div>
    );
  };

  const renderStatusTail = () => (
    <div className={cls(styles.tree_view_node_segment, styles.tree_view_node_tail)}>{renderInlineActions()}</div>
  );

  const renderInlineActions = () => {
    if (item.actions.length > 0) {
      return (
        <div className={styles.tree_view_actions}>
          <TitleActionList
            className={styles.inlineMenu}
            context={[{ treeViewId, treeItemId: item.treeItemId }]}
            nav={item.actions}
            menuId={MenuId.ViewItemContext}
          />
        </div>
      );
    }
  };

  const renderTwice = (item) => {
    if (isDirectory) {
      return renderFolderToggle(item, handlerTwistierClick);
    }
  };

  const getItemTooltip = () => {
    const tooltip = item.tooltip;
    return tooltip || item.name;
  };

  const renderDescription = (node: ExtensionCompositeTreeNode | ExtensionTreeNode) => (
    <div className={cls(styles.tree_view_node_segment_grow, styles.tree_view_node_description)}>
      {!node.name && !node.description ? '——' : node.description}
    </div>
  );

  const renderDecos = () => {
    if (!decoration) {
      return null;
    }

    const badge = decoration.badge || '';
    const kolor = decoration.color;
    const color = kolor && themeService.getColor({ id: kolor });
    return (
      <div className={styles.tree_view_node_tail} style={{ color }}>
        {transformLabelWithCodicon(badge.slice(), {}, iconService.fromString.bind(iconService))}
      </div>
    );
  };

  return (
    <div
      key={item.id}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title={getItemTooltip()}
      className={cls(styles.tree_view_node, decorations ? decorations.classlist : null)}
      data-id={item.id}
      style={fileTreeNodeStyle}
      draggable={draggable}
    >
      <div className={cls(styles.tree_view_node_content)}>
        {renderTwice(item)}
        {renderIcon(item)}
        <div className={styles.tree_view_node_overflow_wrap}>
          {renderDisplayName(item)}
          {renderDescription(item)}
        </div>
        {renderStatusTail()}
        {renderDecos()}
      </div>
    </div>
  );
};

export const TREE_VIEW_NODE_HEIGHT = 22;
