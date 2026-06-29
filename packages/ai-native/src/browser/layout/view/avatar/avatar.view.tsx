import React from 'react';

import { Select } from '@opensumi/ide-components';
import { localize, useInjectable } from '@opensumi/ide-core-browser';
import { AILogoAvatar } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { PanelLayoutMode } from '@opensumi/ide-core-common';

import { AIPanelLayoutService } from '../../panel-layout.service';

import styles from './avatar.module.less';

export const AIChatLogoAvatar = () => {
  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);

  const [layoutMode, setLayoutMode] = React.useState<PanelLayoutMode>(() => panelLayoutService.getLayoutMode());

  React.useEffect(() => {
    setLayoutMode(panelLayoutService.getLayoutMode());
    const disposable = panelLayoutService.onDidChangePanelLayout((mode) => {
      setLayoutMode(mode);
    });
    return () => disposable.dispose();
  }, [panelLayoutService]);

  const handleChatVisible = React.useCallback(() => {
    panelLayoutService.toggleAIChatView(layoutMode);
  }, [layoutMode, panelLayoutService]);

  const handleLayoutModeChange = React.useCallback(
    (value: PanelLayoutMode) => {
      void panelLayoutService.setLayoutMode(value);
    },
    [panelLayoutService],
  );

  return (
    <div className={styles.ai_actions}>
      <div className={styles.ai_switch} onClick={handleChatVisible}>
        <AILogoAvatar iconClassName={styles.avatar_icon_large} />
      </div>
      <div className={styles.layout_switch}>
        <Select<PanelLayoutMode>
          size='small'
          value={layoutMode}
          onChange={handleLayoutModeChange}
          options={[
            { label: localize('ai.native.layout.agentic'), value: 'agentic' },
            { label: localize('ai.native.layout.classic'), value: 'classic' },
          ]}
        />
      </div>
    </div>
  );
};
