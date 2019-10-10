import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { DebugWatchService } from './debug-watch.service';
import { useInjectable } from '@ali/ide-core-browser';
import * as styles from './debug-watch.module.less';
import { SourceTree } from '@ali/ide-core-browser/lib/components';

export const DebugWatchView = observer(() => {
  const {
    nodes,
    onSelect,
    onChange,
  }: DebugWatchService = useInjectable(DebugWatchService);

  const scrollContainerStyle = {
    width: '100%',
  };
  return <div className={styles.debug_watch}>
    <SourceTree
      nodes={nodes}
      onSelect={onSelect}
      onChange={onChange}
      outline={false}
      editable = {true}
      scrollContainerStyle={scrollContainerStyle}
    />
  </div>;
});
