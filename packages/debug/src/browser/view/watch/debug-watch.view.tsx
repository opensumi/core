import * as React from 'react';
import { useInjectable, getIcon } from '@ali/ide-core-browser';
import { ViewState } from '@ali/ide-core-browser';
import { INodeRendererProps, ClasslistComposite, IRecycleTreeHandle, TreeNodeType, RecycleTree, INodeRendererWrapProps, TreeModel, CompositeTreeNode, PromptHandle } from '@ali/ide-components';
import { ExpressionContainer, ExpressionNode, DebugVariableContainer, DebugVariable, DebugWatchNode } from '../../tree/debug-tree-node.define';
import { DebugWatchModelService } from './debug-watch-tree.model.service';
import * as styles from './debug-watch.module.less';
import * as cls from 'classnames';
import { Loading } from '@ali/ide-core-browser/lib/components/loading';

export const DEBUG_WATCH_TREE_FIELD_NAME = 'DEBUG_WATCH_TREE_FIELD';

export const DebugWatchView = ({
  viewState,
}: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const DEBUG_VARIABLE_ITEM_HEIGHT = 22;

  const { height } = viewState;

  const wrapperRef: React.RefObject<HTMLDivElement> = React.createRef();
  const [model, setModel] = React.useState<TreeModel>();

  const debugWatchModelService = useInjectable<DebugWatchModelService>(DebugWatchModelService);

  React.useEffect(() => {
    return initTreeModel();
  }, []);

  const initTreeModel = () => {
    const treeModel = debugWatchModelService.treeModel;
    if (treeModel) {
      treeModel.root.ensureLoaded().then(() => {
        setModel(treeModel);
      });
    }
    const disposable = debugWatchModelService.onDidUpdateTreeModel(async (model: TreeModel) => {
      if (model) {
        await model.root.ensureLoaded();
      }
      setModel(model);
    });
    return () => {
      debugWatchModelService.removeNodeDecoration();
      disposable.dispose();
    };
  };

  const handleTreeReady = (handle: IRecycleTreeHandle) => {
    debugWatchModelService.handleTreeHandler({
      ...handle,
      getModel: () => model!,
      hasDirectFocus: () => wrapperRef.current === document.activeElement,
    });
  };

  const handleTwistierClick = (ev: React.MouseEvent, item: ExpressionNode | ExpressionContainer, type: TreeNodeType) => {
    // 阻止点击事件冒泡
    ev.stopPropagation();

    const { handleTwistierClick } = debugWatchModelService;
    if (!item) {
      return;
    }
    handleTwistierClick(item, type);
  };

  const handlerContextMenu = (ev: React.MouseEvent, node: ExpressionNode | ExpressionContainer) => {
    const { handleContextMenu } = debugWatchModelService;
    handleContextMenu(ev, node);
  };

  const handleOuterContextMenu = (ev: React.MouseEvent) => {
    const { handleContextMenu } = debugWatchModelService;
    // 空白区域右键菜单
    handleContextMenu(ev);
  };

  const handleOuterClick = (ev: React.MouseEvent) => {
    // 空白区域点击，取消焦点状态
    const { enactiveNodeDecoration } = debugWatchModelService;
    enactiveNodeDecoration();
  };

  const handleOuterBlur = (ev: React.FocusEvent) => {
    // 空白区域点击，取消焦点状态
    const { enactiveNodeDecoration } = debugWatchModelService;
    enactiveNodeDecoration();
  };

  const renderWatchNode = React.useCallback((props: INodeRendererWrapProps) => {
    const decorations = debugWatchModelService.decorations.getDecorations(props.item as any);
    return <DebugWatchRenderedNode
      item={props.item}
      itemType={props.itemType}
      decorations={decorations}
      onClick={handleTwistierClick}
      onTwistierClick={handleTwistierClick}
      onContextMenu={handlerContextMenu}
      defaultLeftPadding={12}
      leftPadding={8}
    />;
  }, [model]);

  const renderContent = () => {
    if (!model) {
      return <span />;
    } else {
      return <RecycleTree
        height={height}
        itemHeight={DEBUG_VARIABLE_ITEM_HEIGHT}
        onReady={handleTreeReady}
        model={model!}
        placeholder={() => {
          return <span />;
        }}
      >
        {renderWatchNode}
      </RecycleTree>;
    }
  };

  return <div
    className={styles.debug_watch_container}
    tabIndex={-1}
    ref={wrapperRef}
    onContextMenu={handleOuterContextMenu}
    onClick={handleOuterClick}
    onBlur={handleOuterBlur}
    data-name={DEBUG_WATCH_TREE_FIELD_NAME}
  >
    {renderContent()}
  </div>;
};

export interface IDebugVariableNodeProps {
  item: any;
  defaultLeftPadding?: number;
  leftPadding?: number;
  decorations?: ClasslistComposite;
  onClick: (ev: React.MouseEvent, item: ExpressionNode | ExpressionContainer, type: TreeNodeType) => void;
  onTwistierClick: (ev: React.MouseEvent, item: ExpressionNode | ExpressionContainer, type: TreeNodeType) => void;
  onContextMenu?: (ev: React.MouseEvent, item: ExpressionNode | ExpressionContainer, type: TreeNodeType) => void;
}

export type IDebugWatchNodeRenderedProps = IDebugVariableNodeProps & INodeRendererProps;

export const DebugWatchRenderedNode: React.FC<IDebugWatchNodeRenderedProps> = ({
  item,
  decorations,
  defaultLeftPadding,
  leftPadding,
  onClick,
  onTwistierClick,
  onContextMenu,
  itemType,
}: IDebugWatchNodeRenderedProps) => {

  const isRenamePrompt = itemType === TreeNodeType.RenamePrompt;
  const isNewPrompt = itemType === TreeNodeType.NewPrompt;
  const isPrompt = isRenamePrompt || isNewPrompt;

  const handleClick = (ev: React.MouseEvent) => {
    onClick(ev, item, CompositeTreeNode.is(item) ? TreeNodeType.CompositeTreeNode : TreeNodeType.TreeNode);
  };

  const handleContextMenu = (ev: React.MouseEvent) => {
    if (ev.nativeEvent.which === 0) {
      return;
    }
    if (itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      onContextMenu && onContextMenu(ev, item as ExpressionNode, itemType);
    }
  };

  let paddingLeft;
  if (isPrompt) {
    paddingLeft = `${(defaultLeftPadding || 8) + (item.depth || 0) * (leftPadding || 0)}px`;
  } else {
    paddingLeft = `${(defaultLeftPadding || 8) + (item.depth || 0) * (leftPadding || 0)}px`;
  }

  const editorNodeStyle = {
    height: DEBUG_WATCH_TREE_NODE_HEIGHT,
    lineHeight: `${DEBUG_WATCH_TREE_NODE_HEIGHT}px`,
    paddingLeft,
  } as React.CSSProperties;

  const renderDisplayName = (node: ExpressionContainer | ExpressionNode) => {
    if (isPrompt && node instanceof PromptHandle) {
      return <div
          className={cls(styles.debug_watch_node_segment, styles.debug_watch_node_inputbox)}
        >
          <div className={cls('input-box', styles.debug_watch_node_prompt_box)}>
            <node.ProxiedInput  wrapperStyle={{height: DEBUG_WATCH_TREE_NODE_HEIGHT, padding: '0 5px'}}/>
          </div>
        </div>;
    }
    return <div
      className={cls(styles.debug_watch_node_segment, styles.debug_watch_node_display_name, styles.debug_watch_variable, (node as DebugVariable).description ? styles.name : '')}
    >
      {node.name}
      {(node as DebugVariable).description ? ':' : ''}
    </div>;
  };

  const renderDescription = (node: ExpressionContainer | ExpressionNode) => {
    const booleanRegex = /^true|false$/i;
    const stringRegex = /^(['"]).*\1$/;
    const description = (node as DebugVariableContainer).description ? (node as DebugVariableContainer).description.replace('function', 'f') : '';
    const addonClass = [styles.debug_watch_variable];
    if (isPrompt) {
      return null;
    }
    if (item.variableType === 'number' || item.variableType === 'boolean' || item.variableType === 'string') {
      addonClass.push(styles[item.variableType]);
    } else if (!isNaN(+description)) {
      addonClass.push(styles.number);
    } else if (booleanRegex.test(description)) {
      addonClass.push(styles.boolean);
    } else if (stringRegex.test(description)) {
      addonClass.push(styles.string);
    }
    return <div className={cls(styles.debug_watch_node_segment_grow, styles.debug_watch_node_description, ...addonClass)}>
      {description}
    </div>;
  };

  const renderStatusTail = () => {
    return <div className={cls(styles.debug_watch_node_segment, styles.debug_watch_node_tail)}>
      {renderBadge()}
    </div>;
  };

  const renderBadge = () => {
    return <div className={styles.debug_watch_node_status}>
      {item.badge}
    </div>;
  };

  const getItemTooltip = () => {
    const tooltip = item.tooltip;
    return tooltip;
  };

  const renderToggle = (node: ExpressionContainer, clickHandler: any) => {
    const handleTwiceClick = (ev: React.MouseEvent) => {
      clickHandler(ev, node, itemType);
    };
    if (decorations && decorations?.classlist.indexOf(styles.mod_loading) > -1) {
      return <div className={cls(styles.debug_watch_node_segment, styles.expansion_toggle)}>
        <Loading />
      </div>;
    }
    return <div
      onClick={handleTwiceClick}
      className={cls(
        styles.debug_watch_node_segment,
        styles.expansion_toggle,
        getIcon('right'),
        { [`${styles.mod_collapsed}`]: !(node as ExpressionContainer).expanded },
      )}
    />;

  };

  const renderTwice = (item) => {
    if (DebugWatchNode.is(item)) {
      if ((item as DebugWatchNode).available && (item as DebugWatchNode).variablesReference) {
        return renderToggle(item as ExpressionContainer, onTwistierClick);
      }
    } else if (ExpressionContainer.is(item)) {
      if ((item as ExpressionContainer).variablesReference) {
        return renderToggle(item as ExpressionContainer, onTwistierClick);
      }
    }
  };

  return (
    <div
      key={item.id}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={getItemTooltip()}
      className={cls(
        styles.debug_watch_node,
        decorations ? decorations.classlist : null,
      )}
      style={editorNodeStyle}
      data-id={item.id}
    >
      <div className={cls(styles.debug_watch_node_content)}>
        {renderTwice(item)}
        <div
          style={{ height: DEBUG_WATCH_TREE_NODE_HEIGHT}}
          className={isPrompt ? styles.debug_watch_node_prompt_wrap : styles.debug_watch_node_overflow_wrap}
        >
          {renderDisplayName(item)}
          {renderDescription(item)}
        </div>
        {renderStatusTail()}
      </div>
    </div>
  );
};

export const DEBUG_WATCH_TREE_NODE_HEIGHT = 22;
