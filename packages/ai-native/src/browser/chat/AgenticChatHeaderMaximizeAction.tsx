import React from 'react';

import { getIcon, localize, useInjectable } from '@opensumi/ide-core-browser';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';

import { AIPanelLayoutService } from '../layout/panel-layout.service';

import styles from './chat.module.less';

export const AgenticChatHeaderMaximizeAction = ({ id = 'ai-chat-header-maximize' }: { id?: string }) => {
  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);
  const [panelLayout, setPanelLayout] = React.useState(() => panelLayoutService.getLayoutMode());
  const [isWorkbenchVisible, setIsWorkbenchVisible] = React.useState(
    () => panelLayoutService.isAgenticWorkbenchVisible() !== false,
  );

  const refreshWorkbenchVisibility = React.useCallback(() => {
    const visible = panelLayoutService.isAgenticWorkbenchVisible();
    setIsWorkbenchVisible(typeof visible === 'boolean' ? visible : true);
  }, [panelLayoutService]);

  React.useEffect(() => {
    setPanelLayout(panelLayoutService.getLayoutMode());
    refreshWorkbenchVisibility();

    const disposable = panelLayoutService.onDidChangePanelLayout((mode) => {
      setPanelLayout(mode);
      refreshWorkbenchVisibility();
    });

    return () => {
      disposable.dispose();
    };
  }, [panelLayoutService, refreshWorkbenchVisibility]);

  React.useEffect(() => {
    const disposable = panelLayoutService.onDidChangeAgenticWorkbenchVisibility((visible) => {
      setIsWorkbenchVisible(visible);
    });

    return () => {
      disposable.dispose();
    };
  }, [panelLayoutService]);

  const handleToggleWorkbench = React.useCallback(() => {
    const visible = panelLayoutService.toggleAgenticWorkbenchVisibility(!isWorkbenchVisible);
    if (typeof visible === 'boolean') {
      setIsWorkbenchVisible(visible);
    }
  }, [isWorkbenchVisible, panelLayoutService]);

  if (panelLayout !== 'agentic') {
    return null;
  }

  const title = localize(isWorkbenchVisible ? 'aiNative.chat.expand.fullescreen' : 'aiNative.chat.expand.unfullscreen');
  const icon = getIcon(isWorkbenchVisible ? 'fullescreen' : 'unfullscreen');

  return (
    <div id={id} data-workbench-visible={String(isWorkbenchVisible)}>
      <EnhanceIcon
        wrapperClassName={styles.action_btn}
        className={icon}
        onClick={handleToggleWorkbench}
        tabIndex={0}
        role='button'
        ariaLabel={title}
        ariaPressed={!isWorkbenchVisible}
      />
    </div>
  );
};
