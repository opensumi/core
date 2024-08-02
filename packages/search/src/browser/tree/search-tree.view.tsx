import cls from 'classnames';
import React, { RefObject, useCallback, useEffect, useRef, useState } from 'react';

import { Button, IRecycleTreeHandle, RecycleTree, TreeNodeEvent } from '@opensumi/ide-components';
import { CommandService, ViewState, formatLocalize, localize, useInjectable } from '@opensumi/ide-core-browser';

import { ResultTotal, SEARCH_STATE } from '../../common/content-search';
import styles from '../search.module.less';

import { ISearchNodeRenderedProps, SEARCH_TREE_NODE_HEIGHT, SearchNodeRendered } from './search-node';
import { SearchModelService, SearchTreeModel } from './tree-model.service';

export interface ISearchTreeProp {
  offsetTop: number;
  search: string;
  replace: string;
  total: ResultTotal;
  viewState: ViewState;
  state: SEARCH_STATE;
  isUseRegexp: boolean;
  isMatchCase: boolean;
}

export interface ISearchResultTotalContent {
  total: ResultTotal;
  state: SEARCH_STATE;
  model?: SearchTreeModel;
}

const ResultTotalContent = ({ total, state, model }: ISearchResultTotalContent) => {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const searchModelService = useInjectable<SearchModelService>(SearchModelService);

  const handleClear = useCallback(() => {
    searchModelService.clearSearchResults();
  }, [searchModelService]);

  const handleFold = useCallback(() => {
    const toCollapsed = !collapsed;
    setCollapsed(toCollapsed);
    if (toCollapsed) {
      searchModelService.collapsedAll();
    } else {
      searchModelService.expandAll();
    }
  }, [collapsed, searchModelService]);

  const handleRefresh = useCallback(() => {
    searchModelService.refresh();
  }, [searchModelService]);

  useEffect(() => {
    if (!model) {
      return;
    }
    const dispose = model.root.watcher.on(TreeNodeEvent.DidChangeExpansionState, () => {
      if (collapsed) {
        setCollapsed(!collapsed);
      }
    });
    return () => {
      dispose.dispose();
    };
  }, [model, collapsed]);

  if (total.resultNum > 0) {
    return (
      <p className={styles.result_describe}>
        <span className={styles.text}>
          {formatLocalize('search.files.result', String(total.resultNum), String(total.fileNum))}
        </span>
        <Button
          className={cls(styles.result_fold, { [styles.disabled]: state === SEARCH_STATE.doing })}
          onClick={handleClear}
          type='icon'
          icon='clear'
          title={localize('search.ClearSearchResultsAction.label')}
        ></Button>
        <Button
          className={cls(styles.result_fresh, { [styles.disabled]: state === SEARCH_STATE.doing })}
          onClick={handleRefresh}
          type='icon'
          icon='refresh'
          title={localize('search.RefreshAction.label')}
        ></Button>
        <Button
          className={cls(styles.result_fold, { [styles.disabled]: state === SEARCH_STATE.doing })}
          onClick={handleFold}
          type='icon'
          icon={!collapsed ? 'collapse-all' : 'expand-all'}
          title={localize(
            !collapsed
              ? 'search.CollapseDeepestExpandedLevelAction.label'
              : 'search.ExpandDeepestExpandedLevelAction.label',
          )}
        ></Button>
      </p>
    );
  }
  return null;
};

export const SearchTree = ({
  offsetTop,
  total,
  state,
  replace,
  search,
  viewState,
  isUseRegexp,
  isMatchCase,
}: ISearchTreeProp) => {
  const [model, setModel] = useState<SearchTreeModel | undefined>();
  const searchModelService = useInjectable<SearchModelService>(SearchModelService);
  const commandService = useInjectable<CommandService>(CommandService);
  const wrapperRef: RefObject<HTMLDivElement> = useRef(null);
  const totalRef: RefObject<HTMLDivElement> = useRef(null);

  const [totalHeight, setTotalHeight] = useState<number>(0);

  const { handleTreeBlur, handleTreeFocus } = searchModelService;

  useEffect(() => {
    setModel(searchModelService.treeModel);
    const disposable = searchModelService.onDidUpdateTreeModel((model?: SearchTreeModel) => {
      setModel(model);
    });
    return () => {
      disposable.dispose();
    };
  }, []);

  useEffect(() => {
    if (totalRef.current) {
      setTotalHeight(totalRef.current.clientHeight);
    }
  }, [totalRef.current]);

  const handleTreeReady = useCallback(
    (handle: IRecycleTreeHandle) => {
      searchModelService.handleTreeHandler(handle);
    },
    [searchModelService],
  );

  const renderTreeNode = useCallback(
    (props: ISearchNodeRenderedProps) => (
      <SearchNodeRendered
        item={props.item}
        itemType={props.itemType}
        decorations={searchModelService.decorations.getDecorations(props.item as any)}
        defaultLeftPadding={8}
        search={search}
        replace={replace}
        onClick={searchModelService.handleItemClick}
        onDoubleClick={searchModelService.handleItemDoubleClick}
        onContextMenu={searchModelService.handleContextMenu}
        leftPadding={8}
        isUseRegexp={isUseRegexp}
        isMatchCase={isMatchCase}
        commandService={commandService}
      />
    ),
    [model, search, replace, isUseRegexp, isMatchCase],
  );

  const renderSearchTree = useCallback(() => {
    if (model) {
      return (
        <RecycleTree
          height={viewState.height - offsetTop - totalHeight}
          itemHeight={SEARCH_TREE_NODE_HEIGHT}
          onReady={handleTreeReady}
          model={model}
        >
          {renderTreeNode}
        </RecycleTree>
      );
    }
  }, [model, totalHeight, offsetTop, search, replace, isUseRegexp, isMatchCase, viewState]);

  return (
    <div className={styles.tree} tabIndex={-1} onBlur={handleTreeBlur} onFocus={handleTreeFocus} ref={wrapperRef}>
      <div ref={totalRef}>
        <ResultTotalContent total={total} state={state} model={model} />
      </div>
      {renderSearchTree()}
    </div>
  );
};
