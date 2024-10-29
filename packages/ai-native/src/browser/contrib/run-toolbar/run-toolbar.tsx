import React from 'react';

import { localize, useAutorun, useInjectable } from '@opensumi/ide-core-browser';
import { DebugState } from '@opensumi/ide-debug';
import { DebugAction } from '@opensumi/ide-debug/lib/browser/components';
import { DebugConfigurationService } from '@opensumi/ide-debug/lib/browser/view/configuration/debug-configuration.service';
import { DebugControllerView } from '@opensumi/ide-debug/lib/browser/view/configuration/debug-configuration.view';
import { DebugToolbarService } from '@opensumi/ide-debug/lib/browser/view/configuration/debug-toolbar.service';
import { DebugToolbarView } from '@opensumi/ide-debug/lib/browser/view/configuration/debug-toolbar.view';

import styles from './run-toolbar.module.less';

const CustomDebugBar = () => {
  const { start } = useInjectable<DebugConfigurationService>(DebugConfigurationService);

  return (
    <div className={styles.debug_actions}>
      <DebugAction
        id='debug.action.start'
        icon={'start'}
        label={localize('debug.action.start')}
        run={start}
      ></DebugAction>
    </div>
  );
};

export const AIRunToolbar = () => {
  const debugToolbarService = useInjectable<DebugToolbarService>(DebugToolbarService);
  const state = useAutorun(debugToolbarService.state);

  return (
    <div className={styles.run_toolbar_container}>
      <span className={styles.dividing}></span>
      <DebugControllerView className={styles.debug_controller_view} CustomActionBar={CustomDebugBar} />
      {state !== undefined && state !== DebugState.Inactive && (
        <DebugToolbarView float={false} className={styles.debug_action_bar_internal} />
      )}
    </div>
  );
};
