import React from 'react';
import styles from './index.module.less';
import { localize } from '@ide-framework/ide-core-browser';
import { Button } from '@ide-framework/ide-components';
import { useInjectable } from '@ide-framework/ide-core-browser';
import { DebugConfigurationService } from '../../view/configuration/debug-configuration.service';

export const FloatingClickWidget = ({}: React.HtmlHTMLAttributes<HTMLDivElement>) => {
  const { addConfiguration } = useInjectable<DebugConfigurationService>(DebugConfigurationService);

  return <div className={styles.floating_click_widget}>
      <Button onClick={ addConfiguration } size='large'>{localize('debug.action.add.configuration')}</Button>
  </div>;
};
