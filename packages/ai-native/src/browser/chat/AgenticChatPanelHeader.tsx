import React from 'react';

import { localize, useInjectable } from '@opensumi/ide-core-browser';
import { ChatMessageRole } from '@opensumi/ide-core-common';

import { cleanAttachedTextWrapper } from '../../common/utils';
import { AIPanelLayoutService } from '../layout/panel-layout.service';

import { AgenticChatHeaderMaximizeAction } from './AgenticChatHeaderMaximizeAction';
import { ChatModel } from './chat-model';
import styles from './chat.module.less';

const MAX_TITLE_LENGTH = 100;

export function getAgenticChatPanelTitle(sessionModel: ChatModel | undefined, preferSessionTitle = false): string {
  if (preferSessionTitle && sessionModel?.title) {
    return sessionModel.title.slice(0, MAX_TITLE_LENGTH);
  }

  const messages = sessionModel?.history.getMessages() || [];
  const latestUserMessage = [...messages].find((message) => message.role === ChatMessageRole.User);
  const messageTitle = latestUserMessage
    ? cleanAttachedTextWrapper(latestUserMessage.content).slice(0, MAX_TITLE_LENGTH)
    : '';

  return messageTitle || localize('aiNative.chat.ai.assistant.name');
}

export function AgenticChatPanelHeader({
  preferSessionTitle = false,
  sessionModel,
}: {
  preferSessionTitle?: boolean;
  sessionModel?: ChatModel;
}) {
  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);
  const [panelLayout, setPanelLayout] = React.useState(() => panelLayoutService.getLayoutMode());
  const [title, setTitle] = React.useState(() => getAgenticChatPanelTitle(sessionModel, preferSessionTitle));

  const refreshTitle = React.useCallback(() => {
    setTitle(getAgenticChatPanelTitle(sessionModel, preferSessionTitle));
  }, [preferSessionTitle, sessionModel]);

  React.useEffect(() => {
    setPanelLayout(panelLayoutService.getLayoutMode());
    const disposable = panelLayoutService.onDidChangePanelLayout((mode) => {
      setPanelLayout(mode);
    });

    return () => disposable.dispose();
  }, [panelLayoutService]);

  React.useEffect(() => {
    refreshTitle();
    const disposable = sessionModel?.history.onMessageChange(refreshTitle);

    return () => disposable?.dispose();
  }, [refreshTitle, sessionModel]);

  if (panelLayout !== 'agentic') {
    return null;
  }

  return (
    <div className={styles.agentic_chat_panel_header} data-testid='agentic-chat-panel-header'>
      <div className={styles.agentic_chat_panel_title} data-testid='agentic-chat-panel-header-title' title={title}>
        {title}
      </div>
      <div className={styles.agentic_chat_panel_actions}>
        <AgenticChatHeaderMaximizeAction id='agentic-chat-panel-header-maximize' />
      </div>
    </div>
  );
}
