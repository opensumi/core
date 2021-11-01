import React from 'react';
import styles from './index.module.less';
import { localize } from '@ali/ide-core-browser';
import { Button } from '@ali/ide-components';
import { useInjectable } from '@ali/ide-core-browser';
import { DebugConfigurationService } from '../../view/configuration/debug-configuration.service';

export const FloatingClickWidget = ({}: React.HtmlHTMLAttributes<HTMLDivElement>) => {
  const { addConfiguration } = useInjectable<DebugConfigurationService>(DebugConfigurationService);

  return <div className={styles.floating_click_widget}>
      <Button onClick={ addConfiguration } size='large'>{localize('debug.action.add.configuration')}</Button>
  </div>;
};
