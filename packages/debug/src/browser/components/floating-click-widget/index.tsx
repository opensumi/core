import cls from 'classnames';
import React, { useEffect, useState } from 'react';

import { Button } from '@opensumi/ide-components';
import { getIcon, localize, useAutorun, useInjectable } from '@opensumi/ide-core-browser';
import { EditorContext } from '@opensumi/ide-editor/lib/browser/editor.context';

import { DebugConfigurationService } from '../../view/configuration/debug-configuration.service';

import styles from './index.module.less';

export const FloatingClickWidget = () => {
  const { addConfiguration, openLaunchEditor, showDynamicQuickPickToInsert, dynamicConfigurations } =
    useInjectable<DebugConfigurationService>(DebugConfigurationService);
  const autorunDynamicConfigurations = useAutorun(dynamicConfigurations);

  const { minimapWidth } = React.useContext(EditorContext);

  const [showSmartWidget, setShowSmartWidget] = useState(false);

  useEffect(() => {
    // 如果没有注册的 Dynamic Configuration Provider，就不显示智能添加配置按钮
    if (Array.isArray(autorunDynamicConfigurations) && autorunDynamicConfigurations.length > 0) {
      setShowSmartWidget(true);
    } else {
      setShowSmartWidget(false);
    }
  }, [autorunDynamicConfigurations]);

  return (
    <div className={styles.floating_click_widget} style={{ right: 20 + minimapWidth }}>
      {showSmartWidget && (
        <Button
          className={styles.float_smart_button}
          iconClass={cls(getIcon('magic-wand'), styles.float_smart_button_icon)}
          onClick={showDynamicQuickPickToInsert}
        >
          {localize('debug.action.add.smartAddConfiguration')}
        </Button>
      )}
      <Button onClick={addConfiguration}>{localize('debug.action.add.configuration')}</Button>
      <Button onClick={openLaunchEditor}>{localize('debug.action.open.launch.editor')}</Button>
    </div>
  );
};
