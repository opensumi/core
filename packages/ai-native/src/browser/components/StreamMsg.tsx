import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';

import { IMsgStreamChoices, MsgStreamManager } from '../model/msg-stream-manager';

import * as styles from './components.module.less';

interface IStreamMsgProps {
  sessionId: string;
}

export const StreamMsgWrapper = (props: IStreamMsgProps) => {
  const { sessionId } = props;
  const [msgText, setMsgText] = React.useState('');
  const [chunk, setChunk] = React.useState('');
  const msgStreamManager = useInjectable<MsgStreamManager>(MsgStreamManager);

  useEffect(() => {
    const disposer = msgStreamManager.onMsgListChange(sessionId)((msg: IMsgStreamChoices) => {
      const { delta } = msg;
      setChunk(delta.content);
    });

    return () => disposer.dispose();
  }, [sessionId]);

  useEffect(() => {
    if (chunk) {
      setMsgText(msgText + chunk);
    }
  }, [chunk]);

  return (
    <div className={styles.ai_chat_code_wrapper}>
      <div className={styles.render_text}>{msgText}</div>
    </div>
  );
};
