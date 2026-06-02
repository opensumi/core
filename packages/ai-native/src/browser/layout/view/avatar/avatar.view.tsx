import React from 'react';

import { Select } from '@opensumi/ide-components';
import { localize, useInjectable } from '@opensumi/ide-core-browser';
import { AILogoAvatar } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { PanelLayoutMode } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { AI_CHAT_VIEW_ID } from '../../../../common';
import { AIPanelLayoutService, getAIChatDefaultSize } from '../../panel-layout.service';

import styles from './avatar.module.less';

export const AIChatLogoAvatar = () => {
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
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
    layoutService.toggleSlot(AI_CHAT_VIEW_ID, undefined, getAIChatDefaultSize(layoutMode));
  }, [layoutMode, layoutService]);

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
