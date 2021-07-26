import * as React from 'react';
import * as cls from 'classnames';
import { observer } from 'mobx-react-lite';
import * as styles from './debug-console.module.less';
import { useInjectable, ViewState, getIcon } from '@ali/ide-core-browser';
import { DebugConsoleService } from './debug-console.service';
import { RecycleTree, IRecycleTreeHandle, TreeNodeType, INodeRendererWrapProps, ClasslistComposite, INodeRendererProps, CompositeTreeNode, TreeNode } from '@ali/ide-components';
import { IDebugConsoleModel } from './debug-console-tree.model.service';
import { DebugConsoleNode, AnsiConsoleNode, DebugVariableContainer, TreeWithLinkWrapper } from '../../tree';
import { Loading } from '@ali/ide-core-browser/lib/components/loading';
import { DebugConsoleFilterService } from './debug-console-filter.service';
import { LinkDetector } from '../../debug-link-detector';
import { PreferenceService, CoreConfiguration } from '@ali/ide-core-browser';
import { isSingleCharacter } from '../../debugUtils';

export const DebugConsoleView = observer(({ viewState }: { viewState: ViewState }) => {
  const debugConsoleService = useInjectable<DebugConsoleService>(DebugConsoleService);
  const debugConsoleFilterService = useInjectable<DebugConsoleFilterService>(DebugConsoleFilterService);
  const preferenceService = useInjectable<PreferenceService>(PreferenceService);
  const { tree } = debugConsoleService;
  const debugInputRef = React.createRef<HTMLDivElement>();
  const { height, width } = viewState;
  const [model, setModel] = React.useState<IDebugConsoleModel>();
  const [consoleHeight, setConsoleHeight] = React.useState<number>(26);
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

    const inputDispose = debugConsoleService.onInputHeightChange((height: number) => {
      setConsoleHeight(height);
    });
    return () => {
      tree.removeNodeDecoration();
      filterDispose.dispose();
      inputDispose.dispose();
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

    debugConsoleService.focusInput();
  };

  const handleOuterBlur = (ev: React.FocusEvent) => {
    // 空白区域点击，取消焦点状态
    const { enactiveNodeDecoration } = tree;
    enactiveNodeDecoration();
  };

  const filterMode = (): CoreConfiguration['debug.console.filter.mode'] => {
    return preferenceService.get('debug.console.filter.mode') || 'filter';
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

  const renderOutputNode = React.useCallback((props: INodeRendererWrapProps) => {
    const decorations = tree.decorations.getDecorations(props.item as any);
    return <DebugConsoleRenderedNode
      item={props.item}
      itemType={props.itemType}
      decorations={decorations}
      filterValue={filterValue}
      filterMode={filterMode()}
      onClick={handleTwistierClick}
      onTwistierClick={handleTwistierClick}
      onContextMenu={handlerContextMenu}
      defaultLeftPadding={14}
      leftPadding={8}
    />;
  }, [model, filterValue]);

  const renderOutputContent = () => {
    if (!model) {
      return null;
    }
    return <RecycleTree
        height={Math.max(height - consoleHeight, 26)}
        width={width}
        itemHeight={DEBUG_CONSOLE_TREE_NODE_HEIGHT}
        onReady={handleTreeReady}
        overScanCount={10}
        filter={filterMode() === 'filter' ? filterValue : ''}
        filterProvider={{ fuzzyOptions, filterAlways: true}}
        model={model!.treeModel}
        overflow={ 'auto' }
      >
        {renderOutputNode}
    </RecycleTree>;
  };

  return <div
    className={styles.debug_console}
    onContextMenu={handleOuterContextMenu}
    onClick={handleOuterClick}
  >
    <div
      className={styles.debug_console_output}
      tabIndex={-1}
      onBlur={handleOuterBlur}
      ref={wrapperRef}
      data-name={DEBUG_CONSOLE_TREE_FIELD_NAME}
    >
      {renderOutputContent()}
    </div>
    <div className={styles.variable_repl_bar} style={{ maxHeight: height - 26 + 'px' }}>
      <div className={styles.variable_repl_bar_icon}></div>
      <div className={styles.variable_repl_editor} ref={debugInputRef}></div>
    </div>
  </div>;
});

export interface IDebugConsoleNodeProps {
  item: any;
  defaultLeftPadding?: number;
  leftPadding?: number;
  filterValue?: string;
  filterMode?: CoreConfiguration['debug.console.filter.mode'];
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
  filterValue,
  filterMode,
  onClick,
  onTwistierClick,
  onContextMenu,
  itemType,
}: IDebugConsoleNodeRenderedProps) => {

  const debugConsoleFilterService = useInjectable<DebugConsoleFilterService>(DebugConsoleFilterService);
  const linkDetector: LinkDetector = useInjectable<LinkDetector>(LinkDetector);

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

  const acquireVariableName = () => {
    if (AnsiConsoleNode.is(item)) {
      return '';
    }
    return (DebugConsoleNode.is(item) ? '' : (item as any).name) + (item.description && !DebugConsoleNode.is(item) ? ': ' : '');
  };

  const renderSelectionFilter = () => {
    const desc = acquireVariableName() + item.description;
    const matchers = debugConsoleFilterService.findMatches(desc || '');
    const fValueSplit = (filterValue || '').split('');
    const calcWidth = () => {
      let singleCharLen = 0;
      let doubleCharLen = 0;
      fValueSplit.forEach((s) => {
        if (isSingleCharacter(s)) {
          singleCharLen += 1;
        } else {
          doubleCharLen += 1;
        }
      });
      // 单字节字符 8 的宽度，双字节字符 14 的宽度
      return singleCharLen * DEBUG_CONSOLE_SINGLE_CHAR_LEN + doubleCharLen * DEBUG_CONSOLE_DOUBLE_CHAR_LEN;
    };
    const calcLeft = (index: number) => {
      let singleCharLen = 0;
      let doubleCharLen = 0;
      if (index > 0) {
        Array.from({length: index}).forEach((_, i) => {
          if (isSingleCharacter(desc[i])) {
            singleCharLen += 1;
          } else {
            doubleCharLen += 1;
          }
        });
        return singleCharLen * DEBUG_CONSOLE_SINGLE_CHAR_LEN + doubleCharLen * DEBUG_CONSOLE_DOUBLE_CHAR_LEN;
      }
      return 0;
    };
    const matStyles: React.CSSProperties[] = matchers.map((m) => {
      return {
        height: 16,
        top: 3,
        width: calcWidth(),
        left: calcLeft(m.startIndex),
      };
    });

    return matStyles.map((s) => <div key={s.left} className={styles.block} style={s}></div>);
  };

  const renderDisplayName = (node: DebugConsoleNode | AnsiConsoleNode) => {
    if (AnsiConsoleNode.is(node)) {
      return null;
    }
    return <div
      className={cls(styles.debug_console_node_segment, !DebugConsoleNode.is(node) && styles.debug_console_node_display_name, styles.debug_console_variable, (item as DebugConsoleNode).description ? styles.name : styles.info)}
    >
      {
        <TreeWithLinkWrapper html={ linkDetector.linkify(acquireVariableName())}></TreeWithLinkWrapper>
      }
    </div>;
  };

  const renderDescription = (node: DebugConsoleNode | AnsiConsoleNode) => {
    const booleanRegex = /^true|false$/i;
    const stringRegex = /^(['"]).*\1$/;
    const description = (node as DebugConsoleNode).description || '';
    const addonClass = [styles.debug_console_variable];
    if (AnsiConsoleNode.is(node)) {
      return <div
       className={cls(styles.debug_console_node_segment, styles.debug_console_node_display_name)}
      >
       {(node as AnsiConsoleNode).template()}
      </div>;
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
      <TreeWithLinkWrapper html={ linkDetector.linkify(description) }></TreeWithLinkWrapper>
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
      style={{
        height: DEBUG_CONSOLE_TREE_NODE_HEIGHT,
        lineHeight: `${DEBUG_CONSOLE_TREE_NODE_HEIGHT}px`,
        paddingLeft: `${(defaultLeftPadding || 8) + (item.depth || 0) * (leftPadding || 0)}px`,
      }}
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
      <div className={styles.debug_console_selection}>
        { filterMode === 'matcher' && renderSelectionFilter()}
      </div>
    </div>
  );
};

const DEBUG_CONSOLE_SINGLE_CHAR_LEN = 8;
const DEBUG_CONSOLE_DOUBLE_CHAR_LEN = 14;
export const DEBUG_CONSOLE_TREE_NODE_HEIGHT = 22;
export const DEBUG_CONSOLE_TREE_FIELD_NAME = 'DEBUG_CONSOLE_TREE_FIELD';
