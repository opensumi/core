import cls from 'classnames';
import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';

import { Button } from '@opensumi/ide-components';
import { getIcon, localize, useInjectable } from '@opensumi/ide-core-browser';
import { EditorContext } from '@opensumi/ide-editor/lib/browser/editor.context';

import { DebugConfigurationService } from '../../view/configuration/debug-configuration.service';

import styles from './index.module.less';

export const FloatingClickWidget = observer(() => {
  const { addConfiguration, openLaunchEditor, showDynamicQuickPickToInsert, dynamicConfigurations } =
    useInjectable<DebugConfigurationService>(DebugConfigurationService);
  const { minimapWidth } = React.useContext(EditorContext);

  const [showSmartWidget, setShowSmartWidget] = useState(false);

  useEffect(() => {
    // 如果没有注册的 Dynamic Configuration Provider，就不显示智能添加配置按钮
    if (Array.isArray(dynamicConfigurations) && dynamicConfigurations.length > 0) {
      setShowSmartWidget(true);
    } else {
      setShowSmartWidget(false);
    }
  }, [dynamicConfigurations]);

  return (
    <div className={styles.floating_click_widget} style={{ right: 20 + minimapWidth }}>
      {showSmartWidget && (
        <Button
          className={styles.float_smart_button}
          iconClass={cls(getIcon('magic-wand'), styles.float_smart_button_icon)}
          onClick={showDynamicQuickPickToInsert}
          size='large'
        >
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
});
