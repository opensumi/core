import React from 'react';

import { Button } from '@opensumi/ide-components';
import { localize } from '@opensumi/ide-core-browser';
import { useInjectable } from '@opensumi/ide-core-browser';

import { DebugConfigurationService } from '../../view/configuration/debug-configuration.service';

import styles from './index.module.less';

export const FloatingClickWidget = (_: React.HtmlHTMLAttributes<HTMLDivElement>) => {
  const { addConfiguration } = useInjectable<DebugConfigurationService>(DebugConfigurationService);

  return (
    <div className={styles.floating_click_widget}>
      <Button onClick={addConfiguration} size='large'>
        {localize('debug.action.add.configuration')}
      </Button>
    </div>
  );
};
