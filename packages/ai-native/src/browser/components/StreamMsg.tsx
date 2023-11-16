import hljs from 'highlight.js';
import React, { useCallback, useEffect, useMemo } from 'react';

import { DisposableCollection, useInjectable } from '@opensumi/ide-core-browser';

import { AiChatService } from '../ai-chat.service';
import { EMsgStreamStatus, IMsgStreamChoices, MsgStreamManager } from '../model/msg-stream-manager';

import { CodeBlockWrapper } from './ChatEditor';
import * as styles from './components.module.less';
import { Thinking, ThinkingResult } from './Thinking';

export const StreamMsgWrapper = (props: { sessionId: string }) => {
  const { sessionId } = props;
  const [chunk, setChunk] = React.useState('');
  const [content, setContent] = React.useState<string>('');
  const [isError, setIsError] = React.useState<boolean>(false);
  const [isDone, setIsDone] = React.useState<boolean>(false);
  const [status, setStatus] = React.useState(EMsgStreamStatus.THINKING);
  const msgStreamManager = useInjectable<MsgStreamManager>(MsgStreamManager);

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

  useEffect(() => {
    if (!chunk) {
      return;
    }

    setContent(content + chunk);
  }, [chunk]);

  const renderMsgList = useCallback(() => (
      <div className={styles.ai_chat_code_wrapper}>
        <div className={styles.render_text}>
          {isError ? (
            <span>当前与我互动的人太多，请稍后再试，感谢您的理解与支持</span>
          ) : (
            <CodeBlockWrapper text={content} />
          )}
        </div>
      </div>
    ), [content, isError, isDone, status, sessionId]);

  return status === EMsgStreamStatus.THINKING && msgStreamManager.currentSessionId === sessionId ? (
    <Thinking status={status} message={content}>
      {renderMsgList()}
    </Thinking>
  ) : (
    <ThinkingResult status={status} message={content}>
      {renderMsgList()}
    </ThinkingResult>
  );
};
