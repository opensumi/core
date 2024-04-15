import * as React from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';

import { IChatInternalService } from '../../common/index';
import { ChatInternalService } from '../chat/chat.internal.service';
import { EMsgStreamStatus } from '../model/msg-stream-manager';

import { ChatMarkdown } from './ChatMarkdown';
import { StreamMsgWrapper } from './StreamMsg';

export interface IReplayComponentParam {
  relationId: string;
  renderContent?: (content: string, status: EMsgStreamStatus) => React.ReactNode;
}

// 流式输出渲染组件
export const StreamReplyRender = (props: { prompt: string; params: IReplayComponentParam }) => {
  const { prompt, params } = props;

  const aiChatService = useInjectable<ChatInternalService>(IChatInternalService);

  const { relationId, renderContent } = params;

  const send = React.useCallback(
    (isRetry = false) => {
      aiChatService.setLatestSessionId(relationId);
      aiChatService.messageWithStream(prompt, isRetry ? { enableGptCache: false } : {}, relationId);
    },
    [aiChatService],
  );

  React.useEffect(() => {
    send();
  }, []);

  return (
    <StreamMsgWrapper
      sessionId={relationId}
      prompt={prompt}
      onRegenerate={() => send(true)}
      renderContent={(content, status) =>
        renderContent ? renderContent(content, status) : <ChatMarkdown markdown={content} fillInIncompleteTokens />
      }
    />
  );
};
