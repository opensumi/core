import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';

import { Button } from '@opensumi/ide-components';
import { localize, getIcon } from '@opensumi/ide-core-browser';
import { useInjectable } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import * as monaco from '@opensumi/ide-monaco';

import { DebugConfigurationService } from '../../view/configuration/debug-configuration.service';

import styles from './index.module.less';

export const FloatingClickWidget = observer((_: React.HtmlHTMLAttributes<HTMLDivElement>) => {
  const { addConfiguration, openLaunchEditor, showDynamicQuickPickToInsert, dynamicConfigurations } =
    useInjectable<DebugConfigurationService>(DebugConfigurationService);
  const editorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);

  const [showSmartWidget, setShowSmartWidget] = useState(false);
  const [miniMapWidth, setMiniMapWidth] = useState(0);

  useEffect(() => {
    // 获取 Editor 的 minimap 宽度，对整体按钮做一个偏移
    const miniMapWidth = editorService.currentEditor?.monacoEditor.getOption(monaco.editor.EditorOption.layoutInfo)
      .minimap.minimapWidth;
    if (miniMapWidth) {
      setMiniMapWidth(miniMapWidth);
    }
    // 如果没有注册的 Dynamic Configuration Provider，就不显示智能添加配置按钮
    if (Array.isArray(dynamicConfigurations) && dynamicConfigurations.length > 0) {
      setShowSmartWidget(true);
    } else {
      setShowSmartWidget(false);
    }
  }, [dynamicConfigurations]);

  return (
    <div className={styles.floating_click_widget} style={{ right: 50 + miniMapWidth }}>
      {showSmartWidget && (
        <Button
          className={styles.float_smart_button}
          iconClass={classNames(getIcon('magic-wand'), styles.float_smart_button_icon)}
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
