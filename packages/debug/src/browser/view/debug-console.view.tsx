import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './debug-console.module.less';
import { ViewState } from '@ali/ide-activity-panel';

export const DebugConsoleView = observer(({
  viewState,
}: React.PropsWithChildren<{ viewState: ViewState }>) => {

return <div className={styles.debug_console}>

  </div>;
});
