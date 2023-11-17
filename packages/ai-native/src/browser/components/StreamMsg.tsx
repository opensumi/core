import hljs from 'highlight.js';
import React, { useCallback, useEffect } from 'react';

import { DisposableCollection, useInjectable } from '@opensumi/ide-core-browser';

import { IAIReporter } from '../../common';
import { AiChatService } from '../ai-chat.service';
import { ERROR_RESPONSE } from '../common-reponse';
import { EMsgStreamStatus, IMsgStreamChoices, MsgStreamManager } from '../model/msg-stream-manager';

import { CodeBlockWrapper } from './ChatEditor';
import * as styles from './components.module.less';
import { Thinking, ThinkingResult } from './Thinking';

interface IStreamMsgWrapperProps {
  sessionId: string;
  prompt: string;
  startTime?: number;
}

export const StreamMsgWrapper = (props: IStreamMsgWrapperProps) => {
  const { sessionId, prompt, startTime = 0 } = props;
  const [chunk, setChunk] = React.useState('');
  const [content, setContent] = React.useState<string>('');
  const [isError, setIsError] = React.useState<boolean>(false);
  const [isDone, setIsDone] = React.useState<boolean>(false);
  const [status, setStatus] = React.useState(EMsgStreamStatus.THINKING);
  const msgStreamManager = useInjectable<MsgStreamManager>(MsgStreamManager);
  const aiChatService = useInjectable<AiChatService>(AiChatService);
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

  const report = useCallback((success: boolean, stop: boolean) => {
    aiReporter.end(sessionId, {
      message: content,
      replytime: +new Date() - startTime,
      success,
      isStop: stop,
    });
  }, [content]);

  useEffect(() => {
    if (status === EMsgStreamStatus.DONE) {
      report(true, false);
    }
  }, [status]);

  const handleRegenerate = useCallback(() => {
    reset();
    aiChatService.messageWithStream(prompt, {}, sessionId);
  }, [prompt]);

  const renderMsgList = useCallback(
    () => (
      <div className={styles.ai_chat_code_wrapper}>
        <div className={styles.render_text}>
          {isError ? (
            <span>{ERROR_RESPONSE}</span>
          ) : (
            <CodeBlockWrapper text={content} />
          )}
        </div>
      </div>
    ),
    [content, isError, isDone, status, sessionId],
  );

  const onStop = () => {
    report(false, true);
  };

  return status === EMsgStreamStatus.THINKING && msgStreamManager.currentSessionId === sessionId ? (
    <Thinking status={status} message={content} onStop={onStop}>
      {renderMsgList()}
    </Thinking>
  ) : (
    <ThinkingResult status={status} message={content} onRegenerate={handleRegenerate} sessionId={sessionId}>
      {renderMsgList()}
    </ThinkingResult>
  );
};
