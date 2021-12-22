import React from 'react';
import styles from './index.module.less';
import { localize } from '@opensumi/ide-core-browser';
import { Button } from '@opensumi/ide-components';
import { useInjectable } from '@opensumi/ide-core-browser';
import { DebugConfigurationService } from '../../view/configuration/debug-configuration.service';

export const FloatingClickWidget = () => {
  const { addConfiguration } = useInjectable<DebugConfigurationService>(DebugConfigurationService);

  return (
    <div className={styles.floating_click_widget}>
      <Button onClick={addConfiguration} size='large'>
        {localize('debug.action.add.configuration')}
      </Button>
    </div>
  );
};
