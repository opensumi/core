import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser';
import { DebugHoverService } from './debug-hover.service';
import { observer } from 'mobx-react-lite';
import * as styles from './debug-hover.module.less';

export const DebugHoverContainerView = observer(() => {
  const { value }: DebugHoverService = useInjectable(DebugHoverService);

  if (value) {
    return <div className={ styles.kaitian_debug_hover }>
      <div className={ styles.kaitian_debug_hover_title }>{ value }</div>
      <div className={ styles.kaitian_debug_hover_content }></div>
    </div>;
  } else {
    return null;
  }
});
