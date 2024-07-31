import cls from 'classnames';
import React, { useCallback } from 'react';

import {
  Badge,
  ClasslistComposite,
  CompositeTreeNode,
  ITreeNodeRendererProps,
  Loading,
  TreeNode,
  TreeNodeType,
} from '@opensumi/ide-components';
import {
  CommandService,
  MouseEventButton,
  URI,
  getIcon,
  useDesignStyles,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { InlineMenuBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { IContextMenu } from '@opensumi/ide-core-browser/lib/menu/next';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { IIconTheme, IThemeService } from '@opensumi/ide-theme';

import { ISCMResource, ISCMResourceGroup } from '../../../common';
import { ViewModelContext } from '../../scm-model';

import { SCMTreeDecorationService } from './scm-tree-decoration.service';
import { SCMResourceFile, SCMResourceFolder, SCMResourceGroup, SCMResourceNotRoot } from './scm-tree-node';
import styles from './scm-tree-node.module.less';

export const SCM_TREE_NODE_HEIGHT = 22;
export const SCM_BADGE_LIMIT = 99;

export interface ISCMTreeNodeProps extends ITreeNodeRendererProps {
  item: SCMResourceNotRoot;
  defaultLeftPadding?: number;
  leftPadding?: number;
  decorations?: ClasslistComposite;
  commandService: CommandService;
  onClick: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType, activeUri?: URI) => void;
  onDoubleClick: (
    ev: React.MouseEvent,
    item: TreeNode | CompositeTreeNode,
    type: TreeNodeType,
    activeUri?: URI,
  ) => void;
  onTwistierClick?: (
    ev: React.MouseEvent,
    item: TreeNode | CompositeTreeNode,
    type: TreeNodeType,
    activeUri?: URI,
  ) => void;
  onContextMenu: (
    ev: React.MouseEvent,
    item: TreeNode | CompositeTreeNode,
    type: TreeNodeType,
    activeUri?: URI,
  ) => void;
  decorationService: SCMTreeDecorationService;
  labelService: LabelService;
  iconTheme: Pick<IIconTheme, 'hasFileIcons' | 'hasFolderIcons' | 'hidesExplorerArrows'>;
}

interface ISCMResourceGroupRenderProps extends Omit<ISCMTreeNodeProps, 'decorationService' | 'labelService'> {
  item: SCMResourceGroup;
}

export const SCMResourceGroupNode: React.FC<ISCMResourceGroupRenderProps> = ({
  item,
  defaultLeftPadding = 8,
  leftPadding = 8,
  onClick,
  onDoubleClick,
  onContextMenu,
  itemType,
  decorations,
  onTwistierClick,
}) => {
  const viewModel = useInjectable<ViewModelContext>(ViewModelContext);
  const paddingLeft = `${defaultLeftPadding + (item.depth || 0) * (leftPadding || 0)}px`;
  const styles_expansion_toggle = useDesignStyles(styles.expansion_toggle, 'expansion_toggle');
  const styles_scm_tree_node = useDesignStyles(styles.scm_tree_node, 'scm_tree_node');

  const scmResourceGroup = item.resource as ISCMResourceGroup;
  const renderActionBar = React.useCallback(() => {
    const repoMenus = viewModel.menus.getRepositoryMenus(scmResourceGroup.provider);
    const menus = repoMenus.getResourceGroupMenu(scmResourceGroup);

    return (
      <div className={styles.scm_tree_node_actions}>
        <InlineMenuBar<ISCMResourceGroup> context={[scmResourceGroup]} menus={menus} separator='inline' />
      </div>
    );
  }, [scmResourceGroup /* 依赖项是 SCMResourceGroup 指针 */]);

  const handleContextMenu = useCallback(
    (ev: React.MouseEvent) => {
      if (ev.nativeEvent.button === MouseEventButton.Right) {
        onContextMenu(ev, item, itemType);
      }
    },
    [onContextMenu],
  );

  const handleClick = useCallback(
    (ev: React.MouseEvent) => {
      onClick(ev, item, itemType);
    },
    [onClick],
  );

  const handleDoubleClick = useCallback(
    (ev: React.MouseEvent) => {
      onDoubleClick(ev, item, itemType);
    },
    [onDoubleClick],
  );

  const renderFolderToggle = useCallback(
    (node: SCMResourceGroup, clickHandler: any) => {
      if (decorations && decorations?.classlist.indexOf(styles.mod_loading) > -1) {
        return <Loading />;
      }
      return (
        <div
          onClick={clickHandler}
          className={cls(styles.scm_tree_node_segment, styles_expansion_toggle, getIcon('arrow-right'), {
            [`${styles.mod_collapsed}`]: !(node as SCMResourceGroup).expanded,
          })}
        />
      );
    },
    [decorations],
  );

  const handleTwistierClick = useCallback(
    (ev: React.MouseEvent) => {
      if (itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
        if (onTwistierClick) {
          onTwistierClick(ev, item, itemType);
        } else {
          onClick(ev, item, itemType);
        }
      }
    },
    [onTwistierClick, onClick],
  );

  return (
    <div
      key={item.id}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      className={cls(styles_scm_tree_node, decorations ? decorations.classlist : null)}
      style={{
        height: SCM_TREE_NODE_HEIGHT,
        lineHeight: `${SCM_TREE_NODE_HEIGHT}px`,
        paddingLeft,
      }}
      data-id={item.id}
    >
      <div className={cls(styles.scm_tree_node_content)}>
        {renderFolderToggle(item, handleTwistierClick)}
        <div className={styles.scm_tree_node_overflow_wrap}>
          <div className={cls(styles.scm_tree_node_segment, styles.scm_tree_node_displayname)}>{item.displayName}</div>
        </div>
        {renderActionBar()}
        <div className={cls(styles.scm_tree_node_segment, styles.scm_tree_node_tail)}>
          <Badge>{item.resource.elements.length}</Badge>
        </div>
      </div>
    </div>
  );
};

interface ISCMResourceRenderProps extends ISCMTreeNodeProps {
  item: SCMResourceFile | SCMResourceFolder;
  decorationService: SCMTreeDecorationService;
  labelService: LabelService;
}

export const SCMResourceNode: React.FC<ISCMResourceRenderProps> = ({
  item,
  defaultLeftPadding = 8,
  leftPadding = 8,
  onClick,
  onDoubleClick,
  onTwistierClick,
  onContextMenu,
  itemType,
  decorationService,
  labelService,
  decorations,
  iconTheme,
}) => {
  const viewModel = useInjectable<ViewModelContext>(ViewModelContext);
  const decoration = SCMResourceGroup.is(item) ? null : decorationService.getDecoration(item.uri, false);
  const styles_expansion_toggle = useDesignStyles(styles.expansion_toggle, 'expansion_toggle');
  const styles_scm_tree_node = useDesignStyles(styles.scm_tree_node, 'scm_tree_node');

  const scmResource = item.resource as ISCMResource;

  const renderActionBar = useCallback(() => {
    const repoMenus = viewModel.menus.getRepositoryMenus(scmResource.resourceGroup.provider);
    let menus: IContextMenu;
    let context: ISCMResource[];
    if (itemType === TreeNodeType.TreeNode) {
      menus = repoMenus.getResourceMenu(scmResource);
      context = [scmResource];
    } else {
      menus = repoMenus.getResourceFolderMenu(scmResource.resourceGroup);
      context = (item as SCMResourceFolder).arguments;
    }

    return (
      <div className={styles.scm_tree_node_actions}>
        <InlineMenuBar<ISCMResource> menus={menus} context={context as any} separator='inline' />
      </div>
    );
    /* 当进行 stage/unstage 操作后 resourceGroup 会产生变化需要更新 ActionBar */
  }, [itemType, scmResource.resourceGroup /* 依赖项是 SCMResourceGroup 指针 */]);

  const handleClick = useCallback(
    (ev: React.MouseEvent) => {
      onClick(ev, item, itemType);
    },
    [onClick],
  );

  const handleDoubleClick = useCallback(
    (ev: React.MouseEvent) => {
      onDoubleClick(ev, item, itemType);
    },
    [onDoubleClick],
  );

  const handleContextMenu = useCallback(
    (ev: React.MouseEvent) => {
      if (ev.nativeEvent.button === MouseEventButton.Right) {
        onContextMenu(ev, item, itemType);
      }
    },
    [onContextMenu],
  );

  const isDirectory = SCMResourceFolder.is(item);
  const { hidesExplorerArrows, hasFolderIcons } = iconTheme;
  const paddingLeft = `${
    defaultLeftPadding +
    (item.depth || 0) * (leftPadding || 0) +
    (isDirectory ? 0 : hasFolderIcons ? (hidesExplorerArrows ? 0 : 20) : 0)
  }px`;

  const renderIcon = (node: SCMResourceFolder | SCMResourceFile) => {
    const iconClass = labelService.getIcon(node.uri, { isDirectory: SCMResourceFolder.is(node) });
    return (
      <div
        className={cls(styles.file_icon, iconClass)}
        style={{ height: SCM_TREE_NODE_HEIGHT, lineHeight: `${SCM_TREE_NODE_HEIGHT}px` }}
      />
    );
  };

  const renderDisplayName = useCallback(
    (node: SCMResourceFolder | SCMResourceFile) => (
      <div className={cls(styles.scm_tree_node_segment, styles.scm_tree_node_displayname)}>
        {SCMResourceFolder.is(node) ? node.displayName : labelService.getName(node.uri)}
      </div>
    ),
    [labelService],
  );

  const renderDescription = useCallback(
    (node: SCMResourceFile | SCMResourceFolder) => (
      <div className={cls(styles.scm_tree_node_segment_grow, styles.scm_tree_node_description)}>{node.description}</div>
    ),
    [],
  );

  const themeService = useInjectable<IThemeService>(IThemeService);
  const renderDecos = () => {
    if (!decoration) {
      return null;
    }

    const badge = decoration.badge || item.resource.decorations.letter || '';
    const kolor = decoration.color || item.resource.decorations.color;
    const color = kolor && themeService.getColor({ id: kolor });
    return (
      <div className={styles.scm_tree_node_status} style={{ color }}>
        {badge.slice()}
      </div>
    );
  };

  const getItemTooltip = useCallback(() => {
    let tooltip = item.tooltip;
    if (decoration && decoration.badge) {
      tooltip += ` • ${decoration.tooltip || item.resource.decorations.tooltip || ''}`;
    }
    return tooltip;
  }, [item]);

  const handleTwistierClick = useCallback(
    (ev: React.MouseEvent) => {
      if (itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
        if (onTwistierClick) {
          onTwistierClick(ev, item, itemType);
        } else {
          onClick(ev, item, itemType);
        }
      }
    },
    [onTwistierClick, onClick],
  );

  const renderFolderToggle = useCallback(
    (node: SCMResourceFolder | SCMResourceFile, clickHandler: any) => {
      if (!SCMResourceFolder.is(node)) {
        return null;
      }

      if (decorations && decorations?.classlist.indexOf(styles.mod_loading) > -1) {
        return <Loading />;
      }
      return (
        <div
          onClick={clickHandler}
          className={cls(styles.scm_tree_node_segment, styles_expansion_toggle, getIcon('arrow-right'), {
            [`${styles.mod_collapsed}`]: !(node as SCMResourceFolder).expanded,
          })}
        />
      );
    },
    [decorations],
  );

  return (
    <div
      key={item.id}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      title={getItemTooltip()}
      className={cls(styles_scm_tree_node, decorations ? decorations.classlist : null)}
      style={{
        color: decoration ? decoration.color : '',
        paddingLeft,
        height: SCM_TREE_NODE_HEIGHT,
        lineHeight: `${SCM_TREE_NODE_HEIGHT}px`,
      }}
      data-id={item.id}
    >
      <div className={cls(styles.scm_tree_node_content)}>
        {renderFolderToggle(item, handleTwistierClick)}
        {renderIcon(item)}
        <div
          className={styles.scm_tree_node_overflow_wrap}
          style={{
            textDecoration: decoration && decoration.badge === 'D' ? 'line-through' : 'none',
          }}
        >
          {renderDisplayName(item)}
          {renderDescription(item)}
        </div>
        {renderActionBar()}
        {/* render decorations */}
        <div className={cls(styles.scm_tree_node_segment, styles.scm_tree_node_tail)}>{renderDecos()}</div>
      </div>
    </div>
  );
};

export const SCMTreeNode: React.FC<ISCMTreeNodeProps> = (props) => {
  const { item, ...restProps } = props;
  if (SCMResourceGroup.is(item)) {
    return <SCMResourceGroupNode item={item} {...restProps} />;
  }
  return <SCMResourceNode {...props} item={item} />;
};
