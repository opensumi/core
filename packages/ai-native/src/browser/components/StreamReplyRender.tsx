import * as React from 'react';

import { IAIReporter, uuid } from '@opensumi/ide-core-common';

import { IChatAgentService } from '../../common/index';
import { ChatService } from '../chat/chat.service';
import { EMsgStreamStatus } from '../model/msg-stream-manager';

import { ChatMarkdown } from './ChatMarkdown';
import styles from './components.module.less';
import { StreamMsgWrapper } from './StreamMsg';
import { createMessageByAI } from './utils';

export interface IReplayComponentParam {
  rawMessage: string;
  aiChatService: ChatService;
  aiReporter: IAIReporter;
  chatAgentService: IChatAgentService;
  relationId: string;
  startTime: number;
  isRetry?: boolean;
  renderContent?: (content: string, status: EMsgStreamStatus) => React.ReactNode;
}

// 流式输出渲染组件
export const StreamReplyRender = (prompt: string, params: IReplayComponentParam) => {
  const { aiChatService, relationId, renderContent } = params;

  const send = (isRetry = false) => {
    aiChatService.setLatestSessionId(relationId);
    aiChatService.messageWithStream(prompt, isRetry ? { enableGptCache: false } : {}, relationId);
  };

  send();

  return createMessageByAI({
    id: uuid(6),
    relationId,
    text: (
      <StreamMsgWrapper
        sessionId={relationId}
        prompt={prompt}
        onRegenerate={() => send(true)}
        renderContent={(content, status) =>
          renderContent ? renderContent(content, status) : <ChatMarkdown markdown={content} fillInIncompleteTokens />
        }
      ></StreamMsgWrapper>
    ),
    className: styles.chat_with_more_actions,
  });
};
