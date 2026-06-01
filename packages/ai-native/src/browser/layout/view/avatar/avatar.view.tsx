import React from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Icon } from '@opensumi/ide-core-browser/lib/components';
import { AILogoAvatar } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { AI_CHAT_VIEW_ID } from '../../../../common';
import { AIPanelLayoutService } from '../../panel-layout.service';

import styles from './avatar.module.less';

export const AIChatLogoAvatar = () => {
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);

  const handleChatVisible = React.useCallback(() => {
    layoutService.toggleSlot(AI_CHAT_VIEW_ID);
  }, [layoutService]);

  const handleLayoutModeToggle = React.useCallback(() => {
    void panelLayoutService.toggleLayoutMode();
  }, [panelLayoutService]);

  return (
    <div className={styles.ai_actions}>
      <div className={styles.ai_switch} onClick={handleChatVisible}>
        <AILogoAvatar iconClassName={styles.avatar_icon_large} />
      </div>
      <div className={styles.layout_switch} onClick={handleLayoutModeToggle}>
        <Icon icon='editor' className={`${styles.avatar_icon_large} ${styles.layout_icon}`} />
      </div>
    </div>
  );
};
