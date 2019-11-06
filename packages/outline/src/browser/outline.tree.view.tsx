import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './outline.module.less';
import { ConfigContext, useInjectable, ViewState, localize } from '@ali/ide-core-browser';
import { OutLineService } from './outline.service';
import { RecycleTree } from '@ali/ide-core-browser/lib/components';

export const OutLineTree = observer(({
  viewState,
}: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const outlineService = useInjectable<OutLineService>(OutLineService);
  const {
    treeNodes,
    handleTwistieClick,
    onSelect,
  } = outlineService;
  const nodes = React.useMemo(() => treeNodes, [treeNodes]);
  return (
    nodes.length ?
      <RecycleTree
        nodes={nodes}
        scrollContainerStyle={{
          ...viewState,
        }}
        containerHeight={viewState.height}
        onTwistieClick={handleTwistieClick}
        onSelect={onSelect}
      >
      </RecycleTree> :
      <div className={ styles.empty }>{localize('outline.noinfo', '活动编辑器无法提供大纲信息')}</div>
  );
});
