import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './outline.module.less';
import { ConfigContext, useInjectable, ViewState } from '@ali/ide-core-browser';
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
    <RecycleTree
      nodes={nodes}
      scrollContainerStyle={{
        ...viewState,
      }}
      containerHeight={viewState.height}
      onTwistieClick={handleTwistieClick}
      onSelect={onSelect}
    >
    </RecycleTree>
  );
});
