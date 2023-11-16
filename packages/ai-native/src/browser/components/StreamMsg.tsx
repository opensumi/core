import hljs from 'highlight.js';
import React, { useCallback, useEffect } from 'react';

import { DisposableCollection, useInjectable } from '@opensumi/ide-core-browser';

import { EMsgStreamStatus, IMsgStreamChoices, MsgStreamManager } from '../model/msg-stream-manager';

import { CodeBlockWrapper } from './ChatEditor';
import * as styles from './components.module.less';
import { Thinking, ThinkingResult } from './Thinking';

export const StreamMsgWrapper = (props: { sessionId: string }) => {
  const { sessionId } = props;
  const [chunk, setChunk] = React.useState('');
  const [content, setContent] = React.useState<string>('');
  const [status, setStatus] = React.useState(EMsgStreamStatus.READY);
  const msgStreamManager = useInjectable<MsgStreamManager>(MsgStreamManager);

  useEffect(() => {
    const disposableCollection = new DisposableCollection();

    disposableCollection.push(
      msgStreamManager.onMsgListChange(sessionId)((msg: IMsgStreamChoices) => {
        const { delta } = msg;
        setChunk(delta.content);
      }),
    );

    disposableCollection.push(
      msgStreamManager.onMsgStatus((status) => {
        setStatus(status);
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

  const renderMsgList = useCallback(
    () => (
      <div className={styles.ai_chat_code_wrapper}>
        <div className={styles.render_text}>
          <CodeBlockWrapper text={content} />
        </div>
      </div>
    ),
    [content],
  );

  return status === EMsgStreamStatus.THINKING && msgStreamManager.currentSessionId === sessionId ? (
    <Thinking status={status}>{renderMsgList()}</Thinking>
  ) : (
    <ThinkingResult message={content}>{renderMsgList()}</ThinkingResult>
  );
};
