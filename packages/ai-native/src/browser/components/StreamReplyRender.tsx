import hljs from 'highlight.js';
import React, { useCallback, useEffect, useMemo } from 'react';

import { DisposableCollection, useInjectable } from '@opensumi/ide-core-browser';
import { ChatRenderRegistryToken, IAIReporter, localize } from '@opensumi/ide-core-common';

import { IChatInternalService } from '../../common/index';
import { ChatInternalService } from '../chat/chat.internal.service';
import { ChatRenderRegistry } from '../chat/chat.render.registry';
import { MsgHistoryManager } from '../model/msg-history-manager';
import { EMsgStreamStatus, IMsgStreamChoices, MsgStreamManager } from '../model/msg-stream-manager';

import { ChatMarkdown } from './ChatMarkdown';
import { ChatThinking, ChatThinkingResult } from './ChatThinking';
import styles from './components.module.less';

interface IStreamMsgWrapperProps {
  sessionId: string;
  prompt: string;
  renderContent: (content: string, status: EMsgStreamStatus) => React.ReactNode;
  onRegenerate?: () => void;
  onStop?: () => void;
  startTime?: number;
}

const StreamMsgWrapper = (props: IStreamMsgWrapperProps) => {
  const { sessionId, prompt, startTime = 0, onRegenerate, renderContent } = props;
  const [content, setContent] = React.useState<string>('');
  const contentRef = React.useRef<string>(content);
  const [isError, setIsError] = React.useState<boolean>(false);
  const [isDone, setIsDone] = React.useState<boolean>(false);
  const [status, setStatus] = React.useState(EMsgStreamStatus.THINKING);
  const msgStreamManager = useInjectable<MsgStreamManager>(MsgStreamManager);
  const aiReporter = useInjectable<IAIReporter>(IAIReporter);

  useEffect(() => {
    const disposableCollection = new DisposableCollection();

    disposableCollection.push(
      msgStreamManager.onMsgListChange(sessionId)((msg: IMsgStreamChoices) => {
        if (msg && msgStreamManager.currentSessionId === sessionId) {
          const { delta } = msg;
          contentRef.current = contentRef.current + delta.content;
          setContent(contentRef.current);
        }
      }),
    );

    disposableCollection.push(
      msgStreamManager.onMsgStatus((status) => {
        if (msgStreamManager.currentSessionId === sessionId) {
          setStatus(status);
          setIsError(status === EMsgStreamStatus.ERROR);
          setIsDone(status === EMsgStreamStatus.DONE);
        }
      }),
    );

    hljs.highlightAll();

    return () => disposableCollection.dispose();
  }, [sessionId]);

  const reset = useCallback(() => {
    setContent('');
    contentRef.current = '';
    setIsError(false);
    setIsDone(false);
    setStatus(EMsgStreamStatus.THINKING);
  }, []);

  const report = useCallback(
    (success: boolean, stop: boolean) => {
      aiReporter.end(sessionId, {
        message: content,
        replytime: Date.now() - startTime,
        success,
        isStop: stop,
      });
    },
    [content],
  );

  useEffect(() => {
    if (status === EMsgStreamStatus.DONE) {
      report(true, false);
    }
  }, [status]);

  const handleRegenerate = useCallback(() => {
    reset();
    if (onRegenerate) {
      onRegenerate();
    }
  }, [prompt, onRegenerate]);

  const renderMsgList = useCallback(
    () => (
      <div className={styles.ai_chat_code_wrapper}>
        <div className={styles.render_text}>
          {isError ? <span>{localize('aiNative.chat.error.response')}</span> : renderContent(content, status)}
        </div>
      </div>
    ),
    [content, isError, isDone, status, sessionId, renderContent],
  );

  const onStop = () => {
    report(false, true);
    props.onStop?.();
  };

  const isThinking = useMemo(
    () => status === EMsgStreamStatus.THINKING && msgStreamManager.currentSessionId === sessionId,
    [status, sessionId, msgStreamManager.currentSessionId],
  );

  if (isThinking) {
    return (
      <ChatThinking status={status} message={content} onStop={onStop}>
        {renderMsgList()}
      </ChatThinking>
    );
  }

  return (
    <ChatThinkingResult status={status} message={content} onRegenerate={handleRegenerate} sessionId={sessionId}>
      {renderMsgList()}
    </ChatThinkingResult>
  );
};

export interface IStreamReplyRenderProps {
  prompt: string;
  relationId: string;
  onDidChange?: (content: string) => void;
}

// 流式输出渲染组件
export const StreamReplyRender = (props: IStreamReplyRenderProps) => {
  const { prompt, relationId, onDidChange } = props;

  const aiChatService = useInjectable<ChatInternalService>(IChatInternalService);
  const chatRenderRegistry = useInjectable<ChatRenderRegistry>(ChatRenderRegistryToken);
  const msgHistoryManager = useInjectable<MsgHistoryManager>(MsgHistoryManager);

  const send = React.useCallback(
    (isRetry = false) => {
      aiChatService.setLatestSessionId(relationId);
      aiChatService.messageWithStream(prompt, isRetry ? { enableGptCache: false } : {}, relationId);
    },
    [aiChatService, relationId, prompt],
  );

  const renderContent = useCallback(
    (content: string, status: EMsgStreamStatus) => {
      if (onDidChange) {
        onDidChange(content);
      }

      if (chatRenderRegistry.chatAIRoleRender) {
        const ChatAIRoleRender = chatRenderRegistry.chatAIRoleRender;
        return <ChatAIRoleRender status={status} content={content} />;
      }

      return <ChatMarkdown markdown={content} fillInIncompleteTokens />;
    },
    [chatRenderRegistry, chatRenderRegistry.chatAIRoleRender, msgHistoryManager, onDidChange],
  );

  return (
    <StreamMsgWrapper
      sessionId={relationId}
      prompt={prompt}
      onRegenerate={() => send(true)}
      renderContent={(content, status) => renderContent(content, status)}
    />
  );
};
