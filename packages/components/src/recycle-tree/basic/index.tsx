import React, { useCallback, useRef, useEffect, useState } from 'react';
import CtxMenuTrigger from 'react-ctxmenu-trigger';

import { ClickOutside } from '../../click-outside';
import { RecycleTree, IRecycleTreeHandle } from '../RecycleTree';
import { INodeRendererWrapProps } from '../TreeNodeRendererWrap';
import { ITreeNodeOrCompositeTreeNode } from '../types';

import { BasicMenuItem } from './menubar-item';
import { placements } from './placements';
import { BasicTreeNodeRenderer } from './tree-node';
import { BasicCompositeTreeNode, BasicTreeNode } from './tree-node.define';
import { BasicTreeModel, BasicTreeService } from './tree-service';
import { IBasicContextMenu, IBasicRecycleTreeProps, IBasicTreeMenu } from './types';

import './styles.less';
import 'react-ctxmenu-trigger/assets/index.css';

export * from './types';

export const BasicRecycleTree: React.FC<IBasicRecycleTreeProps> = ({
  width,
  height,
  itemHeight = 22,
  itemClassname,
  indent,
  baseIndent,
  containerClassname,
  onClick,
  onContextMenu,
  onTwistierClick,
  onIconClick,
  onDbClick,
  resolveChildren,
  sortComparator,
  treeData,
  inlineMenus,
  inlineMenuActuator,
  onReady,
  contextMenus,
  contextMenuActuator,
  treeName,
}) => {
  const [showMenus, setShowMenus] = useState<{
    show: boolean;
    point?: {
      pageX: number;
      pageY: number;
    };
    activeNode?: BasicCompositeTreeNode | BasicTreeNode;
  }>({ show: false });
  const [menubarItems, setMenubarItems] = useState<IBasicTreeMenu[]>([]);
  const [model, setModel] = useState<BasicTreeModel | undefined>();
  const isDisposed = useRef<boolean>(false);
  const treeService = useRef<BasicTreeService>();
  const treeHandle = useRef<IRecycleTreeHandle>();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const renderTreeNode = useCallback(
    (props: INodeRendererWrapProps) => (
      <BasicTreeNodeRenderer
        item={props.item as any}
        itemType={props.itemType}
        itemHeight={itemHeight}
        indent={indent}
        baseIndent={baseIndent}
        className={itemClassname}
        inlineMenus={inlineMenus}
        inlineMenuActuator={inlineMenuActuator}
        onClick={handleItemClick}
        onDbClick={handleItemDbClick}
        onContextMenu={handleContextMenu}
        onTwistierClick={handleTwistierClick}
        onIconClick={handleItemIconClick}
        decorations={treeService.current?.decorations.getDecorations(props.item as ITreeNodeOrCompositeTreeNode)}
      />
    ),
    [model],
  );

  useEffect(() => {
    treeService.current = new BasicTreeService(treeData, resolveChildren, sortComparator, {
      treeName,
    });
    const disposable = treeService.current?.onDidUpdateTreeModel((model?: BasicTreeModel) => {
      ensureLoaded(model);
    });
    const handleBlur = () => {
      treeService.current?.enactiveFocusedDecoration();
    };
    wrapperRef.current?.addEventListener('blur', handleBlur, true);

    return () => {
      isDisposed.current = true;
      wrapperRef.current?.removeEventListener('blur', handleBlur, true);
      disposable.dispose();
      treeService.current?.dispose();
    };
  }, []);

  useEffect(() => {
    treeService.current?.updateTreeData(treeData);
  }, [treeData]);

  const ensureLoaded = async (model?: BasicTreeModel) => {
    if (model) {
      await model.ensureReady;
    }
    if (!isDisposed.current) {
      setModel(model);
    }
  };

  const selectItem = async (item: BasicCompositeTreeNode | BasicTreeNode) => {
    treeService.current?.activeFocusedDecoration(item);
    if (BasicCompositeTreeNode.is(item)) {
      toggleDirectory(item);
    }
  };

  const handleTreeReady = useCallback(
    (handle: IRecycleTreeHandle) => {
      if (onReady) {
        onReady({
          ...handle,
          selectItem,
          focusItem: async (nodePath: string) => {
            const path = `/${treeName}/${nodePath}`;
            await model?.ensureReady;
            const node = (await handle.ensureVisible(path, 'auto', true)) as BasicCompositeTreeNode;
            if (node) {
              treeService.current?.activeFocusedDecoration(node);
            }
          },
        });
      }
      treeHandle.current = handle;
    },
    [treeService.current],
  );

  const handleItemClick = useCallback(
    (event: React.MouseEvent, item: BasicCompositeTreeNode | BasicTreeNode) => {
      selectItem(item);
      if (onClick) {
        onClick(event, item);
      }
    },
    [onClick],
  );

  const handleItemIconClick = useCallback(
    (event: React.MouseEvent, item: BasicCompositeTreeNode | BasicTreeNode) => {
      if (onIconClick) {
        onIconClick(event, item);
      }
    },
    [onIconClick],
  );

  const handleItemDbClick = useCallback(
    (event: React.MouseEvent, item: BasicCompositeTreeNode | BasicTreeNode) => {
      if (onDbClick) {
        onDbClick(event, item);
      }
    },
    [onDbClick],
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, item: BasicCompositeTreeNode | BasicTreeNode) => {
      if (item) {
        treeService.current?.activeContextMenuDecoration(item);
      } else {
        treeService.current?.enactiveFocusedDecoration();
      }
      if (onContextMenu) {
        onContextMenu(event, item);
      } else {
        // let menus: IBasicTreeMenu[] = [];
        let rawMenus: IBasicContextMenu[] = [];
        if (Array.isArray(contextMenus)) {
          rawMenus = contextMenus;
        } else if (typeof contextMenus === 'function') {
          rawMenus = contextMenus(item);
        }
        const groups = new Set<string>();
        const menusMap = {};
        for (const menu of rawMenus) {
          groups.add(menu.group || '-1');
          if (!menusMap[menu.group || '-1']) {
            menusMap[menu.group || '-1'] = [];
          }
          menusMap[menu.group || '-1'].push(menu);
        }
        const sortGroup = Array.from(groups).sort((a, b) => a.localeCompare(b, 'kn', { numeric: true }));
        let menus: IBasicTreeMenu[] = [];
        for (const group of sortGroup) {
          menus = menus.concat(menusMap[group].map((menu) => ({ id: menu.id, label: menu.title, group: menu.group })));
          menus = menus.concat([{ id: `${group}_divider`, label: '', type: 'divider' }]);
        }
        menus.pop();
        if (JSON.stringify(menus) !== JSON.stringify(menubarItems)) {
          setMenubarItems(menus);
        }
        const { x, y } = event.nativeEvent;
        setShowMenus({ show: true, point: { pageX: x, pageY: y }, activeNode: item });
      }
    },
    [onDbClick],
  );

  const toggleDirectory = useCallback((item: BasicCompositeTreeNode) => {
    if (item.expanded) {
      treeHandle.current?.collapseNode(item);
    } else {
      treeHandle.current?.expandNode(item);
    }
  }, []);

  const handleTwistierClick = useCallback(
    (event: React.MouseEvent, item: BasicCompositeTreeNode | BasicTreeNode) => {
      if (BasicCompositeTreeNode.is(item)) {
        toggleDirectory(item);
      }
      if (onTwistierClick) {
        onTwistierClick(event, item);
      }
    },
    [onTwistierClick],
  );

  const handleOuterClick = useCallback(() => {
    treeService.current?.enactiveFocusedDecoration();
  }, []);

  const handleOuterContextMenu = useCallback(
    (event: React.MouseEvent, item?: BasicCompositeTreeNode | BasicTreeNode) => {
      if (onContextMenu) {
        onContextMenu(event, item);
      }
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setShowMenus({ ...showMenus, show: false });
  }, [showMenus]);

  const renderContextMenu = useCallback(() => {
    if (!contextMenus) {
      return null;
    }
    return (
      <CtxMenuTrigger
        popupPlacement='bottomLeft'
        popupVisible={showMenus.show}
        action={['contextMenu']}
        popupAlign={{
          overflow: {
            adjustX: 1,
            adjustY: 1,
          },
          offset: [window.scrollX, window.scrollY],
        }}
        point={showMenus.point || {}}
        builtinPlacements={placements}
        popup={
          <ClickOutside
            className='basic_tree_menubars'
            mouseEvents={['click', 'contextmenu']}
            onOutsideClick={handleMouseLeave}
          >
            {menubarItems.map(({ id, label, type }) => (
              <BasicMenuItem
                key={id}
                id={id}
                label={label}
                type={type}
                focusMode={showMenus.show}
                onClick={(id: string) => {
                  if (contextMenuActuator) {
                    contextMenuActuator(showMenus.activeNode!, id);
                  }
                  setShowMenus({ show: false });
                }}
              />
            ))}
          </ClickOutside>
        }
        alignPoint
      />
    );
  }, [menubarItems, contextMenuActuator, showMenus]);

  return (
    <div
      className='basic_tree'
      tabIndex={-1}
      ref={wrapperRef}
      onClick={handleOuterClick}
      onContextMenu={handleOuterContextMenu}
    >
      {renderContextMenu()}
      {model ? (
        <RecycleTree
          height={height}
          width={width}
          itemHeight={itemHeight}
          model={model}
          onReady={handleTreeReady}
          className={containerClassname}
          leaveBottomBlank
        >
          {renderTreeNode}
        </RecycleTree>
      ) : null}
    </div>
  );
};
