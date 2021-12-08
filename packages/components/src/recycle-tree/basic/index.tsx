import React, { useCallback, useRef, useEffect, useState } from 'react';
import { RecycleTree, IRecycleTreeHandle } from '../RecycleTree';
import { ITreeNodeOrCompositeTreeNode } from '../types';
import { INodeRendererWrapProps } from '../TreeNodeRendererWrap';
import { IBasicRecycleTreeProps } from './types';
import { BasicTreeModel, BasicTreeService } from './tree-service';
import { BasicTreeNodeRenderer } from './tree-node';
import { BasicCompositeTreeNode, BasicTreeNode } from './tree-node.define';
import cls from 'classnames';
import './styles.less';

export const BasicRecycleTree: React.FC<IBasicRecycleTreeProps> = ({
  width,
  height,
  itemHeight = 22,
  itemClassname,
  indent,
  containerClassname,
  onClick,
  onContextMenu,
  onTwistierClick,
  onDbClick,
  resolveChildren,
  sortComparator,
  treeData,
  inlineMenus,
  inlineMenuActuator,
  onReady,
  contextMenus,
  contextMenuActuator,
}) => {
  const [model, setModel] = useState<BasicTreeModel | undefined>();
  const treeService = useRef<BasicTreeService>(new BasicTreeService(treeData, resolveChildren, sortComparator));
  const treeHandle = useRef<IRecycleTreeHandle>();
  const wrapperRef: React.RefObject<HTMLDivElement> = React.createRef();

  const renderTreeNode = useCallback((props: INodeRendererWrapProps) => {
    return <BasicTreeNodeRenderer
      item={props.item as any}
      itemType={props.itemType}
      itemHeight={itemHeight}
      indent={indent}
      className={itemClassname}
      inlineMenus={inlineMenus}
      inlineMenuActuator={inlineMenuActuator}
      onClick={handleItemClick}
      onDbClick={handleItemDbClick}
      onContextMenu={handleContextMenu}
      onTwistierClick={handleTwistierClick}
      decorations={treeService.current.decorations.getDecorations(props.item as ITreeNodeOrCompositeTreeNode)}
    />;
  }, []);

  useEffect(() => {
    ensureLoaded();
    const disposable = treeService.current.onDidUpdateTreeModel(async (model?: BasicTreeModel) => {
      await model?.root.ensureLoaded();
      setModel(model);
    });
    const handleBlur = () => {
      treeService.current?.enactiveFocusedDecoration();
    };
    wrapperRef.current?.addEventListener('blur', handleBlur, true);

    return () => {
      wrapperRef.current?.removeEventListener('blur', handleBlur, true);
      disposable.dispose();
      treeService.current?.dispose();
    };
  }, []);

  const ensureLoaded = async () => {
    const model = treeService.current.model;
    if (model) {
      await model.root.ensureLoaded();
    }
    setModel(model);
  };

  const handleTreeReady = useCallback((handle: IRecycleTreeHandle) => {
    if (onReady) {
      onReady(handle);
    }
    treeHandle.current = handle;
  }, []);

  const handleItemClick = useCallback((event: React.MouseEvent, item: BasicCompositeTreeNode | BasicTreeNode) => {
    treeService.current?.activeFocusedDecoration(item);
    if (onClick) {
      onClick(event, item);
    }
    if (BasicCompositeTreeNode.is(item)) {
      toggleDirectory(item);
    }
  }, [onClick]);

  const handleItemDbClick = useCallback((event: React.MouseEvent, item: BasicCompositeTreeNode | BasicTreeNode) => {
    if (onDbClick) {
      onDbClick(event, item);
    }
  }, [onDbClick]);

  const handleContextMenu = useCallback((event: React.MouseEvent, item: BasicCompositeTreeNode | BasicTreeNode) => {
    if (item) {
      treeService.current?.activeContextMenuDecoration(item);
    } else {
      treeService.current?.enactiveFocusedDecoration();
    }
    if (onContextMenu) {
      onContextMenu(event, item);
    }
  }, [onDbClick]);

  const toggleDirectory = useCallback((item: BasicCompositeTreeNode) => {
    if (item.expanded) {
      treeHandle.current?.collapseNode(item);
    } else {
      treeHandle.current?.expandNode(item);
    }
  }, []);

  const handleTwistierClick = useCallback((event: React.MouseEvent, item: BasicCompositeTreeNode | BasicTreeNode) => {
    if (BasicCompositeTreeNode.is(item)) {
      toggleDirectory(item);
    }
    if (onTwistierClick) {
      onTwistierClick(event, item);
    }
  }, [onTwistierClick]);

  const handleOuterClick = useCallback(() => {
    treeService.current?.enactiveFocusedDecoration();
  }, []);

  const handleOuterContextMenu = useCallback((event: React.MouseEvent, item?: BasicCompositeTreeNode | BasicTreeNode) => {
    if (onContextMenu) {
      onContextMenu(event);
    }
  }, []);

  return <div
    className='basic_tree'
    tabIndex={-1}
    ref={wrapperRef}
    onClick={handleOuterClick}
    onContextMenu={handleOuterContextMenu}
  >
    {
      model
      ? <RecycleTree
        height={height}
        width={width}
        itemHeight={itemHeight}
        model={model}
        onReady={handleTreeReady}
        className={cls(containerClassname)}
      >
        {renderTreeNode}
      </RecycleTree>
      : null
    }
  </div>;
};
