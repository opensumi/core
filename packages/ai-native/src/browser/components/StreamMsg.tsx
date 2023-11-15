import hljs from 'highlight.js';
import React, { useCallback, useEffect, useMemo } from 'react';

import { DisposableCollection, useInjectable } from '@opensumi/ide-core-browser';

import { EMsgStreamStatus, IMsgStreamChoices, MsgStreamManager } from '../model/msg-stream-manager';

import { CodeBlockWrapper } from './ChatEditor';
import * as styles from './components.module.less';
import { Thinking } from './Thinking';

export const StreamMsgWrapper = (props: { sessionId: string }) => {
  const { sessionId } = props;
  const [chunk, setChunk] = React.useState('');
  const [content, setContent] = React.useState<string>('');
  const [isError, setIsError] = React.useState<boolean>(false);
  const [status, setStatus] = React.useState(EMsgStreamStatus.READY);
  const msgStreamManager = useInjectable<MsgStreamManager>(MsgStreamManager);

  useEffect(() => {
    const disposableCollection = new DisposableCollection();

    disposableCollection.push(
      msgStreamManager.onMsgListChange(sessionId)((msg: IMsgStreamChoices) => {
        if (msg) {
          const { delta } = msg;
          setChunk(delta.content);
        }
      }),
    );

    disposableCollection.push(
      msgStreamManager.onMsgStatus((status) => {
        setStatus(status);

        if (msgStreamManager.currentSessionId === sessionId) {
          setIsError(status === EMsgStreamStatus.ERROR);
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

  const renderMsgList = useCallback(
    () => (
      <div className={styles.ai_chat_code_wrapper}>
        <div className={styles.render_text}>
          {isError ? (
            <span>当前与我互动的人太多，请稍后再试，感谢您的理解与支持</span>
          ) : (
            <CodeBlockWrapper text={content} />
          )}
        </div>
      </div>
    ),
    [content, isError],
  );

  return status === EMsgStreamStatus.THINKING && msgStreamManager.currentSessionId === sessionId ? (
    <Thinking>{renderMsgList()}</Thinking>
  ) : (
    renderMsgList()
  );
};
