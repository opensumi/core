import React from 'react';

import { Button } from '@opensumi/ide-components';
import { localize, useInjectable } from '@opensumi/ide-core-browser';

import { DebugConfigurationService } from '../../view/configuration/debug-configuration.service';

import styles from './index.module.less';

export const FloatingClickWidget = (_: React.HtmlHTMLAttributes<HTMLDivElement>) => {
  const { addConfiguration, openLaunchEditor, showDynamicQuickPickToInsert } =
    useInjectable<DebugConfigurationService>(DebugConfigurationService);

  return (
    <div className={styles.floating_click_widget}>
      <Button onClick={showDynamicQuickPickToInsert} size='large'>
        {localize('debug.action.add.smartAddConfiguration')}
      </Button>
      <Button onClick={addConfiguration} size='large'>
        {localize('debug.action.add.configuration')}
      </Button>
      <Button onClick={openLaunchEditor} size='large'>
        {localize('debug.action.open.launch.editor')}
      </Button>
    </div>
  );
};
