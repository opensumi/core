import React from 'react';

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

  const targetLayoutMode: PanelLayoutMode = layoutMode === 'classic' ? 'agentic' : 'classic';
  const layoutSwitchLabel =
    layoutMode === 'classic' ? localize('ai.native.layout.openAgentic') : localize('ai.native.layout.openClassic');

  const handleLayoutModeChange = React.useCallback(() => {
    void panelLayoutService.setLayoutMode(targetLayoutMode);
  }, [panelLayoutService, targetLayoutMode]);

  return (
    <div className={styles.ai_actions}>
      {layoutMode !== 'agentic' && (
        <div className={styles.ai_switch} onClick={handleChatVisible}>
          <AILogoAvatar iconClassName={styles.avatar_icon_large} />
        </div>
      )}
      <div className={styles.layout_switch}>
        <button
          type='button'
          className={styles.layout_switch_button}
          data-testid='layout-switch-button'
          onClick={handleLayoutModeChange}
        >
          {layoutSwitchLabel}
        </button>
      </div>
    </div>
  );
};
