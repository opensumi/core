import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser';
import { DebugVariableService } from './debug-variable.service';
import { observer } from 'mobx-react-lite';
import * as styles from './debug-variable.module.less';
import { SourceTree } from '@ali/ide-core-browser/lib/components';
import { ViewState } from '@ali/ide-core-browser';

export const DebugVariableView = observer(({
  viewState,
}: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const {
    nodes,
    onSelect,
    onContextMenu,
  }: DebugVariableService = useInjectable(DebugVariableService);
  const scrollContainerStyle = {
    width: viewState.width,
    height: viewState.height,
  };
  return <div className={styles.debug_variables}>
    <SourceTree
      nodes={nodes}
      onSelect={onSelect}
      onContextMenu={onContextMenu}
      outline={false}
      scrollContainerStyle={scrollContainerStyle}
    />
  </div>;
});
