import hljs from 'highlight.js';
import React, { useCallback, useEffect } from 'react';

import { DisposableCollection, useInjectable } from '@opensumi/ide-core-browser';
import { IAIReporter, localize } from '@opensumi/ide-core-common';

import { EMsgStreamStatus, IMsgStreamChoices, MsgStreamManager } from '../model/msg-stream-manager';

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

export const StreamMsgWrapper = (props: IStreamMsgWrapperProps) => {
  const { sessionId, prompt, startTime = 0, onRegenerate, renderContent } = props;
  const [chunk, setChunk] = React.useState('');
  const [content, setContent] = React.useState<string>('');
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
          setChunk(delta.content);
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
    setChunk('');
    setContent('');
    setIsError(false);
    setIsDone(false);
    setStatus(EMsgStreamStatus.THINKING);
  }, []);

  useEffect(() => {
    if (!chunk) {
      return;
    }

    setContent(content + chunk);
  }, [chunk]);

  const report = useCallback(
    (success: boolean, stop: boolean) => {
      aiReporter.end(sessionId, {
        message: content,
        replytime: +new Date() - startTime,
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

  return status === EMsgStreamStatus.THINKING && msgStreamManager.currentSessionId === sessionId ? (
    <ChatThinking status={status} message={content} onStop={onStop}>
      {renderMsgList()}
    </ChatThinking>
  ) : (
    <ChatThinkingResult status={status} message={content} onRegenerate={handleRegenerate} sessionId={sessionId}>
      {renderMsgList()}
    </ChatThinkingResult>
  );
};
