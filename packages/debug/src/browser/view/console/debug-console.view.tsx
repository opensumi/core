import * as React from 'react';
import * as cls from 'classnames';
import { observer } from 'mobx-react-lite';
import * as styles from './debug-console.module.less';
import { useInjectable, ViewState, getIcon } from '@ali/ide-core-browser';
import { DebugConsoleService } from './debug-console.service';
import { RecycleTree, IRecycleTreeHandle, TreeNodeType, INodeRendererWrapProps, ClasslistComposite, INodeRendererProps, CompositeTreeNode, TreeNode } from '@ali/ide-components';
import { IDebugConsoleModel } from './debug-console-tree.model.service';
import { DebugConsoleNode, AnsiConsoleNode, DebugConsoleVariableContainer, DebugVariableContainer } from '../../tree';
import { Loading } from '@ali/ide-core-browser/lib/components/loading';
import { DebugConsoleFilterService } from './debug-console-filter.service';

export const DebugConsoleView = observer(({ viewState }: { viewState: ViewState }) => {
  const debugConsoleService = useInjectable<DebugConsoleService>(DebugConsoleService);
  const debugConsoleFilterService = useInjectable<DebugConsoleFilterService>(DebugConsoleFilterService);
  const { tree } = debugConsoleService;
  const debugInputRef = React.createRef<HTMLDivElement>();
  const { height, width } = viewState;
  const [model, setModel] = React.useState<IDebugConsoleModel>();
  const [filterValue, setFilterValue] = React.useState<string>('');
  const wrapperRef: React.RefObject<HTMLDivElement> = React.createRef();

  React.useEffect(() => {
    debugConsoleService.initConsoleInputMonacoInstance(debugInputRef.current);
  }, [debugInputRef.current]);

  React.useEffect(() => {
    tree.onDidUpdateTreeModel(async (model: IDebugConsoleModel) => {
      if (model) {
        await model.treeModel!.root.ensureLoaded();
      }
      setModel(model);
    });
    const filterDispose = debugConsoleFilterService.onDidValueChange((value: string) => {
      setFilterValue(value);
    });
    return () => {
      tree.removeNodeDecoration();
      filterDispose.dispose();
    };
  }, []);

  const handleTreeReady = (handle: IRecycleTreeHandle) => {
    tree.handleTreeHandler({
      ...handle,
      getModel: () => model?.treeModel!,
      hasDirectFocus: () => wrapperRef.current === document.activeElement,
    });
  };

  const handleTwistierClick = (ev: React.MouseEvent, item: AnsiConsoleNode | DebugConsoleNode, type: TreeNodeType) => {
    // 阻止点击事件冒泡
    ev.stopPropagation();

    const { handleTwistierClick } = tree;
    if (!item) {
      return;
    }
    handleTwistierClick(item, type);
  };

  const handlerContextMenu = (ev: React.MouseEvent, node: AnsiConsoleNode | DebugConsoleNode) => {
    const { handleContextMenu } = tree;
    handleContextMenu(ev, node);
  };

  const handleOuterContextMenu = (ev: React.MouseEvent) => {
    const { handleContextMenu } = tree;
    // 空白区域右键菜单
    handleContextMenu(ev);
  };

  const handleOuterClick = (ev: React.MouseEvent) => {
    // 空白区域点击，取消焦点状态
    const { enactiveNodeDecoration } = tree;
    enactiveNodeDecoration();
  };

  const handleOuterBlur = (ev: React.FocusEvent) => {
    // 空白区域点击，取消焦点状态
    const { enactiveNodeDecoration } = tree;
    enactiveNodeDecoration();
  };

  const fuzzyOptions = () => {
    return {
      pre: '<match>',
      post: '</match>',
      extract: (node: DebugConsoleNode | AnsiConsoleNode | DebugVariableContainer) => {
        return node.description ? node.description : node.name;
      },
    };
  };

  const renderOutputContent = () => {
    if (!model) {
      return null;
    }
    return <div
      className={styles.debug_console_output}
      tabIndex={-1}
      onContextMenu={handleOuterContextMenu}
      onClick={handleOuterClick}
      onBlur={handleOuterBlur}
      ref={wrapperRef}
      data-name={DEBUG_CONSOLE_TREE_FIELD_NAME}
    >
      <RecycleTree
        height={height - 26}
        width={width}
        itemHeight={DEBUG_CONSOLE_TREE_NODE_HEIGHT}
        onReady={handleTreeReady}
        filter={filterValue}
        filterProvider={{ fuzzyOptions, filterAlways: true}}
        model={model!.treeModel}
        overflow={ 'auto' }
      >
        {(props: INodeRendererWrapProps) => {
          const decorations = tree.decorations.getDecorations(props.item as any);
          return <DebugConsoleRenderedNode
            item={props.item}
            itemType={props.itemType}
            decorations={decorations}
            onClick={handleTwistierClick}
            onTwistierClick={handleTwistierClick}
            onContextMenu={handlerContextMenu}
            defaultLeftPadding={14}
            leftPadding={8}
          />;
        }}
      </RecycleTree>
    </div>;
  };

  return <div className={styles.debug_console}>
    {renderOutputContent()}
    <div className={styles.variable_repl_bar}>
      <div className={styles.variable_repl_editor} ref={debugInputRef}></div>
    </div>
  </div>;
});

export interface IDebugConsoleNodeProps {
  item: any ;
  defaultLeftPadding?: number;
  leftPadding?: number;
  decorations?: ClasslistComposite;
  onClick: (ev: React.MouseEvent, item: AnsiConsoleNode | DebugConsoleNode | TreeNode, type: TreeNodeType) => void;
  onTwistierClick: (ev: React.MouseEvent, item: AnsiConsoleNode | DebugConsoleNode | TreeNode, type: TreeNodeType) => void;
  onContextMenu?: (ev: React.MouseEvent, item: AnsiConsoleNode | DebugConsoleNode | TreeNode, type: TreeNodeType) => void;
}

export type IDebugConsoleNodeRenderedProps = IDebugConsoleNodeProps & INodeRendererProps;

export const DebugConsoleRenderedNode: React.FC<IDebugConsoleNodeRenderedProps> = ({
  item,
  decorations,
  defaultLeftPadding,
  leftPadding,
  onClick,
  onTwistierClick,
  onContextMenu,
  itemType,
}: IDebugConsoleNodeRenderedProps) => {

  const handleClick = (ev: React.MouseEvent) => {
    onClick(ev, item, CompositeTreeNode.is(item) ? TreeNodeType.CompositeTreeNode : TreeNodeType.TreeNode);
  };

  const handleContextMenu = (ev: React.MouseEvent) => {
    if (ev.nativeEvent.which === 0) {
      return;
    }
    if (itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      onContextMenu && onContextMenu(ev, item as AnsiConsoleNode, itemType);
    }
  };

  const paddingLeft = `${(defaultLeftPadding || 8) + (item.depth || 0) * (leftPadding || 0)}px`;

  const editorNodeStyle = {
    height: DEBUG_CONSOLE_TREE_NODE_HEIGHT,
    lineHeight: `${DEBUG_CONSOLE_TREE_NODE_HEIGHT}px`,
    paddingLeft,
  } as React.CSSProperties;

  const renderDisplayName = (node: DebugConsoleNode | AnsiConsoleNode) => {
    if (AnsiConsoleNode.is(node)) {
      return null;
    }
    return <div
      className={cls(styles.debug_console_node_segment, !DebugConsoleNode.is(node) && styles.debug_console_node_display_name, styles.debug_console_variable, !DebugConsoleVariableContainer.is(node) && (item as DebugConsoleNode).description ? styles.name : styles.info)}
    >
      {DebugConsoleVariableContainer.is(node) ? node.description : DebugConsoleNode.is(node) ? '' : (node as any).name}
      {!DebugConsoleVariableContainer.is(node) && (node as DebugConsoleNode).description && !DebugConsoleNode.is(node) ? ':' : ''}
    </div>;
  };

  const renderDescription = (node: DebugConsoleNode | AnsiConsoleNode) => {
    const booleanRegex = /^true|false$/i;
    const stringRegex = /^(['"]).*\1$/;
    const description = (node as DebugConsoleNode).description ? (node as DebugConsoleNode).description.replace('function', 'f') : '';
    const addonClass = [styles.debug_console_variable];
    if (AnsiConsoleNode.is(node)) {
      return <div
       className={cls(styles.debug_console_node_segment, styles.debug_console_node_display_name)}
      >
       {(node as AnsiConsoleNode).template()}
      </div>;
    }
    if (DebugConsoleVariableContainer.is(node)) {
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
    return <div className={cls(styles.debug_console_node_segment_grow, styles.debug_console_node_description, ...addonClass)}>
      {description}
    </div>;
  };

  const renderStatusTail = () => {
    return <div className={cls(styles.debug_console_node_segment, styles.debug_console_node_tail)}>
      {renderBadge()}
    </div>;
  };

  const renderBadge = () => {
    if (AnsiConsoleNode.is(item)) {
      return <div className={styles.debug_console_node_status} title={item.source?.path}>
        {item.source?.name ? `${item.source?.name}:${item.line}` : ''}
      </div>;
    }
    return <div className={styles.debug_console_node_status}>
      {item.badge}
    </div>;
  };

  const getItemTooltip = () => {
    const tooltip = item.tooltip;
    return tooltip;
  };

  const renderToggle = (node: DebugConsoleNode, clickHandler: any) => {
    const handleTwiceClick = (ev: React.MouseEvent) => {
      clickHandler(ev, node, itemType);
    };
    if (decorations && decorations?.classlist.indexOf(styles.mod_loading) > -1) {
      return <div className={cls(styles.debug_console_node_segment, styles.expansion_toggle)}>
        <Loading />
      </div>;
    }
    if (DebugConsoleNode.is(node) && !(node as DebugConsoleNode).variablesReference) {
      return null;
    }
    return <div
      onClick={handleTwiceClick}
      className={cls(
        styles.debug_console_node_segment,
        styles.expansion_toggle,
        getIcon('right'),
        { [`${styles.mod_collapsed}`]: !(node as DebugConsoleNode).expanded },
      )}
    />;

  };

  const renderTwice = (item) => {
    if (CompositeTreeNode.is(item)) {
      return renderToggle(item as DebugConsoleNode, onTwistierClick);
    }
  };

  return (
    <div
      key={item.id}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={getItemTooltip()}
      className={cls(
        styles.debug_console_node,
        decorations ? decorations.classlist : null,
      )}
      style={editorNodeStyle}
      data-id={item.id}
    >
      <div className={cls(styles.debug_console_node_content)}>
        {renderTwice(item)}
        <div
          className={styles.debug_console_node_overflow_wrap}
        >
          {renderDisplayName(item)}
          {renderDescription(item)}
        </div>
        {renderStatusTail()}
      </div>
    </div>
  );
};

export const DEBUG_CONSOLE_TREE_NODE_HEIGHT = 22;
export const DEBUG_CONSOLE_TREE_FIELD_NAME = 'DEBUG_CONSOLE_TREE_FIELD';
