import cls from 'classnames';
import { debounce } from 'lodash';
import { observer } from 'mobx-react-lite';
import React from 'react';

import {
  RecycleTree,
  IRecycleTreeHandle,
  TreeNodeType,
  INodeRendererWrapProps,
  ClasslistComposite,
  INodeRendererProps,
  CompositeTreeNode,
  TreeNode,
  TreeNodeEvent,
} from '@opensumi/ide-components';
import { Loading } from '@opensumi/ide-components';
import { useInjectable, ViewState, getIcon } from '@opensumi/ide-core-browser';
import { PreferenceService, PreferenceChange, CoreConfiguration } from '@opensumi/ide-core-browser';
import { Disposable } from '@opensumi/ide-core-common';

import { LinkDetector } from '../../debug-link-detector';
import { CharWidthReader } from '../../debugUtils';
import { DebugConsoleNode, AnsiConsoleNode, DebugVariableContainer, TreeWithLinkWrapper } from '../../tree';

import { DebugConsoleFilterService } from './debug-console-filter.service';
import { IDebugConsoleModel } from './debug-console-tree.model.service';
import styles from './debug-console.module.less';
import { DebugConsoleService } from './debug-console.service';

declare const ResizeObserver: any;

export const DebugConsoleView = observer(({ viewState }: { viewState: ViewState }) => {
  const debugConsoleService = useInjectable<DebugConsoleService>(DebugConsoleService);
  const debugConsoleFilterService = useInjectable<DebugConsoleFilterService>(DebugConsoleFilterService);
  const preferenceService = useInjectable<PreferenceService>(PreferenceService);
  const { consoleModel } = debugConsoleService;
  const debugInputRef = React.createRef<HTMLDivElement>();
  const { height, width } = viewState;
  const [model, setModel] = React.useState<IDebugConsoleModel>();
  const [consoleHeight, setConsoleHeight] = React.useState<number>(26);
  const [filterValue, setFilterValue] = React.useState<string>('');
  const [isWordWrap, setIsWordWrap] = React.useState<boolean>(true);
  const disposer = new Disposable();
  const wrapperRef: React.RefObject<HTMLDivElement> = React.createRef();

  React.useEffect(() => {
    debugConsoleService.init(debugInputRef.current);
  }, [debugInputRef.current]);

  React.useEffect(() => {
    disposer.addDispose(
      consoleModel.onDidUpdateTreeModel(async (model: IDebugConsoleModel) => {
        if (model) {
          await model.treeModel!.root.ensureLoaded();
          disposer.addDispose(
            model.treeModel.root.watcher.on(TreeNodeEvent.WillChangeExpansionState, () => {
              consoleModel.treeHandle.layoutItem();
            }),
          );
        }
        setModel(model);
      }),
    );

    disposer.addDispose(
      debugConsoleFilterService.onDidValueChange((value: string) => {
        setFilterValue(value);
      }),
    );

    disposer.addDispose(
      debugConsoleService.onInputHeightChange((height: number) => {
        setConsoleHeight(height);
      }),
    );

    disposer.addDispose(
      preferenceService.onSpecificPreferenceChange('debug.console.wordWrap', (change: PreferenceChange) => {
        const { newValue } = change;
        setIsWordWrap(newValue);
      }),
    );

    setIsWordWrap(!!preferenceService.get('debug.console.wordWrap', isWordWrap));

    return () => {
      consoleModel.removeNodeDecoration();
      disposer.dispose();
    };
  }, []);

  React.useEffect(() => {
    if (wrapperRef.current && isWordWrap) {
      let animationFrame: number;
      const layoutDebounce = debounce(() => consoleModel.treeHandle?.layoutItem(), 10);
      const resizeObserver = new ResizeObserver(() => {
        animationFrame = window.requestAnimationFrame(() => layoutDebounce());
      });
      resizeObserver.observe(wrapperRef.current);
      return () => {
        resizeObserver.unobserve(wrapperRef.current!);
        if (animationFrame) {
          window.cancelAnimationFrame(animationFrame);
        }
      };
    }
  }, [wrapperRef.current]);

  React.useEffect(() => {
    if (model && isWordWrap) {
      disposer.addDispose(
        model.treeModel.state.onChangeScrollOffset(() => {
          consoleModel.treeHandle.layoutItem();
        }),
      );
    }
  }, [model, isWordWrap]);

  const handleTreeReady = (handle: IRecycleTreeHandle) => {
    consoleModel.handleTreeHandler({
      ...handle,
      getModel: () => model?.treeModel!,
      hasDirectFocus: () => wrapperRef.current === document.activeElement,
    });
  };

  const handleTwistierClick = (ev: React.MouseEvent, item: AnsiConsoleNode | DebugConsoleNode, type: TreeNodeType) => {
    const selection = window.getSelection();
    if (selection && selection.type === 'Range' && selection.rangeCount > 0) {
      // 当用户有选中日志内容时阻止冒泡，防止在选中之后 focus 到 debug console input
      ev.stopPropagation();
    }

    const { handleTwistierClick } = consoleModel;
    if (!item) {
      return;
    }
    handleTwistierClick(item, type);
  };

  const handlerContextMenu = (ev: React.MouseEvent, node: AnsiConsoleNode | DebugConsoleNode) => {
    const { handleContextMenu } = consoleModel;
    handleContextMenu(ev, node);
  };

  const handleOuterContextMenu = (ev: React.MouseEvent) => {
    const { handleContextMenu } = consoleModel;
    // 空白区域右键菜单
    handleContextMenu(ev);
  };

  const handleConsoleClick = (ev: React.MouseEvent) => {
    // 空白区域点击，取消焦点状态
    const { enactiveNodeDecoration } = consoleModel;
    enactiveNodeDecoration();

    debugConsoleService.focusInput();
  };

  const handleOuterBlur = (ev: React.FocusEvent) => {
    // 空白区域点击，取消焦点状态
    const { enactiveNodeDecoration } = consoleModel;
    enactiveNodeDecoration();
  };

  const filterMode = (): CoreConfiguration['debug.console.filter.mode'] => 'filter';

  const fuzzyOptions = () => ({
    pre: '<match>',
    post: '</match>',
    extract: (node: DebugConsoleNode | AnsiConsoleNode | DebugVariableContainer) =>
      node.description ? node.description : node.name,
  });

  const renderOutputNode = React.useCallback(
    (props: INodeRendererWrapProps) => {
      const decorations = consoleModel.decorations.getDecorations(props.item as any);
      return (
        <DebugConsoleRenderedNode
          item={props.item}
          itemType={props.itemType}
          decorations={decorations}
          filterValue={filterValue}
          filterMode={filterMode()}
          onClick={handleTwistierClick}
          onTwistierClick={handleTwistierClick}
          onContextMenu={handlerContextMenu}
          defaultLeftPadding={14}
          isWordWrap={isWordWrap}
          leftPadding={8}
        />
      );
    },
    [model, filterValue, isWordWrap],
  );

  const renderOutputContent = () => {
    if (!model) {
      return null;
    }
    return (
      <RecycleTree
        height={Math.max(height - consoleHeight, 26)}
        width={width}
        itemHeight={DEBUG_CONSOLE_TREE_NODE_HEIGHT}
        onReady={handleTreeReady}
        overScanCount={10}
        filter={filterMode() === 'filter' ? filterValue : ''}
        filterProvider={{ fuzzyOptions, filterAlways: true }}
        model={model!.treeModel}
        overflow={'auto'}
        supportDynamicHeights={isWordWrap}
      >
        {renderOutputNode}
      </RecycleTree>
    );
  };

  return (
    <div className={styles.debug_console} onContextMenu={handleOuterContextMenu} onClick={handleConsoleClick}>
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
    </div>
  );
});

export interface IDebugConsoleNodeProps {
  item: any;
  defaultLeftPadding?: number;
  leftPadding?: number;
  filterValue?: string;
  filterMode?: CoreConfiguration['debug.console.filter.mode'];
  decorations?: ClasslistComposite;
  isWordWrap?: boolean;
  onClick: (ev: React.MouseEvent, item: AnsiConsoleNode | DebugConsoleNode | TreeNode, type: TreeNodeType) => void;
  onTwistierClick: (
    ev: React.MouseEvent,
    item: AnsiConsoleNode | DebugConsoleNode | TreeNode,
    type: TreeNodeType,
  ) => void;
  onContextMenu?: (
    ev: React.MouseEvent,
    item: AnsiConsoleNode | DebugConsoleNode | TreeNode,
    type: TreeNodeType,
  ) => void;
}

export type IDebugConsoleNodeRenderedProps = IDebugConsoleNodeProps & INodeRendererProps;

export const DebugConsoleRenderedNode: React.FC<IDebugConsoleNodeRenderedProps> = ({
  item,
  decorations,
  defaultLeftPadding,
  leftPadding,
  filterMode,
  filterValue,
  onClick,
  onTwistierClick,
  onContextMenu,
  isWordWrap,
  itemType,
}: IDebugConsoleNodeRenderedProps) => {
  const debugConsoleFilterService = useInjectable<DebugConsoleFilterService>(DebugConsoleFilterService);
  const linkDetector: LinkDetector = useInjectable<LinkDetector>(LinkDetector);
  const [computedStyle, setComputedStyle] = React.useState<string>();

  React.useEffect(() => {
    const computed = window.getComputedStyle(
      AnsiConsoleNode.is(item) ? item.el : linkDetector.linkify((item as DebugConsoleNode).description),
      null,
    );
    const fontStyle = `${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize}/${computed.lineHeight} ${computed.fontFamily}`;
    setComputedStyle(fontStyle);
  }, [item]);

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
    return (
      (DebugConsoleNode.is(item) ? '' : (item as any).name) +
      (item.description && !DebugConsoleNode.is(item) ? ': ' : '')
    );
  };

  const getTextWidth = (char: string, font: string): number => CharWidthReader.getInstance().getCharWidth(char, font);

  const renderSelectionFilter = React.useCallback(() => {
    if (!computedStyle) {
      return;
    }

    const desc = acquireVariableName() + item.description;
    const matchers = debugConsoleFilterService.findMatches(desc || '');
    const toNumFixed = (n: number) => Number(n.toFixed(4));

    const calcWidth = (index: number, count: number) =>
      Array.from({ length: count }, (_, i) => i).reduce(
        (pre: number, cur: number) => pre + toNumFixed(getTextWidth(desc.charAt(index + cur), computedStyle)),
        0,
      );

    // 在每次计算 left 的时候临时存储上一次的结果（这在每次计算大量日志内容的时候很有用）
    const cacheLeftMap: Map<number, { startIndex: number; left: number }> = new Map();

    const calcLeft = (startIndex: number, preIndex: number) => {
      if (startIndex > 0) {
        const excute = (len: number, start: number, initial: number) =>
          Array.from({ length: len - start }, (_, i) => start + i).reduce(
            (pre: number, cur: number) => toNumFixed(pre + getTextWidth(desc.charAt(cur), computedStyle)),
            initial,
          );

        let left: number;
        if (preIndex !== 0 && cacheLeftMap.has(matchers[preIndex].startIndex)) {
          const pre = cacheLeftMap.get(matchers[preIndex].startIndex)!;
          left = excute(startIndex, pre.startIndex, pre.left);
        } else {
          left = excute(startIndex, 0, 0);
        }
        cacheLeftMap.set(startIndex, { startIndex, left });
        return left;
      }
      return 0;
    };

    const matStyles: React.CSSProperties[] = matchers.map((m, i) => ({
      height: 16,
      top: 3,
      width: calcWidth(m.startIndex, m.count),
      left: calcLeft(m.startIndex, Math.max(0, i - 1)),
    }));

    return matStyles.map((s) => <div key={s.left} className={styles.block} style={s}></div>);
  }, [filterValue, computedStyle]);

  const renderDisplayName = (node: DebugConsoleNode | AnsiConsoleNode) => {
    if (AnsiConsoleNode.is(node)) {
      return null;
    }
    if (node instanceof DebugConsoleNode && node.variablesReference === 0) {
      return null;
    }
    return (
      <div
        className={cls(
          styles.debug_console_node_segment,
          !DebugConsoleNode.is(node) && styles.debug_console_node_display_name,
          styles.debug_console_variable,
          (item as DebugConsoleNode).description ? styles.name : styles.info,
        )}
      >
        {<TreeWithLinkWrapper html={linkDetector.linkify(acquireVariableName())}></TreeWithLinkWrapper>}
      </div>
    );
  };

  const renderDescription = (node: DebugConsoleNode | AnsiConsoleNode) => {
    const booleanRegex = /^true|false$/i;
    const stringRegex = /^(['"]).*\1$/;
    const description = (node as DebugConsoleNode).description || '';
    const addonClass = [styles.debug_console_variable];
    if (AnsiConsoleNode.is(node)) {
      return (
        <div className={cls(styles.debug_console_node_segment, styles.debug_console_node_display_name)}>
          {(node as AnsiConsoleNode).template()}
        </div>
      );
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
    return (
      <div
        className={cls(styles.debug_console_node_segment_grow, styles.debug_console_node_description, ...addonClass)}
      >
        <TreeWithLinkWrapper html={linkDetector.linkify(description)}></TreeWithLinkWrapper>
      </div>
    );
  };

  const renderStatusTail = () => (
    <div className={cls(styles.debug_console_node_segment, styles.debug_console_node_tail)}>{renderBadge()}</div>
  );

  const renderBadge = () => {
    if (AnsiConsoleNode.is(item)) {
      return (
        <div className={styles.debug_console_node_status} title={item.source?.path}>
          {item.source?.name ? `${item.source?.name}:${item.line}` : ''}
        </div>
      );
    }
    return <div className={styles.debug_console_node_status}>{item.badge}</div>;
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
      return (
        <div className={cls(styles.debug_console_node_segment, styles.expansion_toggle)}>
          <Loading />
        </div>
      );
    }
    if (node instanceof DebugConsoleNode && (node as DebugConsoleNode).variablesReference === 0) {
      return null;
    }

    return (
      <div
        onClick={handleTwiceClick}
        className={cls(styles.debug_console_node_segment, styles.expansion_toggle, getIcon('right'), {
          [`${styles.mod_collapsed}`]: !(node as DebugConsoleNode).expanded,
        })}
      />
    );
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
      className={cls(styles.debug_console_node, decorations ? decorations.classlist : null)}
      style={{
        paddingLeft: `${(defaultLeftPadding || 8) + (item.depth || 0) * (leftPadding || 0)}px`,
      }}
      data-id={item.id}
    >
      <div className={cls(styles.debug_console_node_content)}>
        {renderTwice(item)}
        <div
          className={styles.debug_console_node_overflow_wrap}
          style={{
            whiteSpace: isWordWrap ? 'pre-wrap' : 'nowrap',
            cursor: item instanceof DebugVariableContainer ? 'pointer' : 'initial',
          }}
        >
          {renderDisplayName(item)}
          {renderDescription(item)}
        </div>
        {renderStatusTail()}
      </div>
      <div className={styles.debug_console_selection}>{filterMode === 'matcher' && renderSelectionFilter()}</div>
    </div>
  );
};

export const DEBUG_CONSOLE_TREE_NODE_HEIGHT = 22;
export const DEBUG_CONSOLE_TREE_FIELD_NAME = 'DEBUG_CONSOLE_TREE_FIELD';
