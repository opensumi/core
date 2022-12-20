import cls from 'classnames';
import React, { useEffect, useState, RefObject, useRef, useCallback, memo } from 'react';

import { IRecycleTreeHandle, RecycleTree, Button } from '@opensumi/ide-components';
import { localize, formatLocalize, useInjectable } from '@opensumi/ide-core-browser';
import { ViewState } from '@opensumi/ide-core-browser';

import { ResultTotal, SEARCH_STATE } from '../../common/content-search';
import styles from '../search.module.less';

import { SearchNodeRendered, SEARCH_TREE_NODE_HEIGHT, ISearchNodeRenderedProps } from './search-node';
import { SearchModelService, SearchTreeModel } from './tree-model.service';

export interface ISearchTreeProp {
  offsetTop: number;
  search: string;
  replace: string;
  total: ResultTotal;
  viewState: ViewState;
  state: SEARCH_STATE;
}

export interface ISearchResultTotalContent {
  total: ResultTotal;
  state: SEARCH_STATE;
}

const ResultTotalContent = memo(({ total, state }: ISearchResultTotalContent) => {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  if (total.resultNum > 0) {
    return (
      <p className={styles.result_describe}>
        {formatLocalize('search.files.result', String(total.resultNum), String(total.fileNum))}
        <Button
          className={cls(
            styles.result_fold,
            { [styles.result_fold_enabled]: total.fileNum > 0 },
            { [styles.result_fold_disabled]: state === SEARCH_STATE.doing },
          )}
          type='icon'
          icon={!collapsed ? 'collapse-all' : 'expand-all'}
          title={localize(
            !collapsed
              ? 'search.CollapseDeepestExpandedLevelAction.label'
              : 'search.ExpandDeepestExpandedLevelAction.label',
          )}
        ></Button>
        <Button
          className={styles.result_fresh}
          type='icon'
          icon='refresh'
          title={localize('search.RefreshAction.label')}
        ></Button>
      </p>
    );
  }
  return null;
});

export const SearchTree = ({ offsetTop, total, state, replace, search, viewState }: ISearchTreeProp) => {
  const [model, setModel] = useState<SearchTreeModel | undefined>();
  const searchModelService: SearchModelService = useInjectable(SearchModelService);
  const wrapperRef: RefObject<HTMLDivElement> = useRef(null);

  const { handleTreeBlur, handleTreeFocus } = searchModelService;

  const handleTreeReady = useCallback(
    (handle: IRecycleTreeHandle) => {
      searchModelService.handleTreeHandler(handle);
    },
    [searchModelService],
  );

  useEffect(() => {
    setModel(searchModelService.treeModel);
    const disposable = searchModelService.onDidUpdateTreeModel((model?: SearchTreeModel) => {
      setModel(model);
    });
    return () => {
      disposable.dispose();
    };
  }, []);

  const renderTreeNode = useCallback(
    (props: ISearchNodeRenderedProps) => {
      const handleClick = useCallback(() => {
        searchModelService.handleItemClick(props.item);
      }, [searchModelService, props]);

      return (
        <SearchNodeRendered
          item={props.item}
          itemType={props.itemType}
          decorations={searchModelService.decorations.getDecorations(props.item as any)}
          defaultLeftPadding={8}
          search={search}
          replace={replace}
          onClick={handleClick}
          leftPadding={8}
        />
      );
    },
    [model, search, replace],
  );

  const renderSearchTree = useCallback(() => {
    if (model) {
      return (
        <RecycleTree
          height={viewState.height - offsetTop - 50}
          itemHeight={SEARCH_TREE_NODE_HEIGHT}
          onReady={handleTreeReady}
          model={model}
        >
          {renderTreeNode}
        </RecycleTree>
      );
    }
  }, [model, search, replace]);

  return (
    <div className={styles.tree} tabIndex={-1} onBlur={handleTreeBlur} onFocus={handleTreeFocus} ref={wrapperRef}>
      <ResultTotalContent total={total} state={state} />
      {renderSearchTree()}
    </div>
  );
};
