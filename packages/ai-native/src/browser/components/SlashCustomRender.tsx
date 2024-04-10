import * as React from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { IAIReporter, isPromise, uuid } from '@opensumi/ide-core-common';

import { IAIChatService, IChatAgentService } from '../../common/index';
import { ChatService } from '../chat/chat.service';
import { EMsgStreamStatus } from '../model/msg-stream-manager';
import { TSlashCommandCustomRender } from '../types';

import { ChatMarkdown } from './ChatMarkdown';
import { ChatThinking, ChatThinkingResult } from './ChatThinking';
import { StreamMsgWrapper } from './StreamMsg';
import { createMessageByAI } from './utils';

// slash command 自定义渲染组件
export const SlashCustomRender = (props: {
  message: string;
  relationId: string;
  renderContent: TSlashCommandCustomRender;
  startTime: number;
}) => {
  const { message, relationId, renderContent, startTime } = props;

  const aiChatService = useInjectable<ChatService>(IAIChatService);
  const aiReporter = useInjectable<IAIReporter>(IAIReporter);

  React.useEffect(() => {
    aiChatService.setLatestSessionId(relationId);

    aiReporter.end(relationId, {
      message,
      replytime: Date.now() - startTime,
      success: true,
      isStop: false,
    });
  }, [renderContent, relationId]);

  return <div>{renderContent({ userMessage: message })}</div>;
};
