import React, { useEffect, useState } from 'react';

import { Button } from '@opensumi/ide-components';
import { localize } from '@opensumi/ide-core-browser';
import { useInjectable } from '@opensumi/ide-core-browser';

import { DebugConfigurationService } from '../../view/configuration/debug-configuration.service';

import styles from './index.module.less';

export const FloatingClickWidget = (_: React.HtmlHTMLAttributes<HTMLDivElement>) => {
  const { addConfiguration, openLaunchEditor, showDynamicQuickPickToInsert, getDynamicSupportTypes } =
    useInjectable<DebugConfigurationService>(DebugConfigurationService);

  const [showSmartWidget, setShowSmartWidget] = useState(false);

  useEffect(() => {
    // 如果没有注册的 Dynamic Configuration Provider，就不显示智能添加配置按钮
    getDynamicSupportTypes().then((types) => {
      setShowSmartWidget(types.length > 0);
    });
  }, []);

  return (
    <div className={styles.floating_click_widget}>
      {showSmartWidget && (
        <Button onClick={showDynamicQuickPickToInsert} size='large'>
          {localize('debug.action.add.smartAddConfiguration')}
        </Button>
      )}
      <Button onClick={addConfiguration} size='large'>
        {localize('debug.action.add.configuration')}
      </Button>
      <Button onClick={openLaunchEditor} size='large'>
        {localize('debug.action.open.launch.editor')}
      </Button>
    </div>
  );
};
