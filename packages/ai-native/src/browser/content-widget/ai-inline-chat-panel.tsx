import clsx from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getIcon, useInjectable } from '@opensumi/ide-core-browser';
import { getExternalIcon } from '@opensumi/ide-core-browser';
import { Button, Icon } from '@opensumi/ide-core-browser/lib/components/index';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';
import { Emitter } from '@opensumi/ide-core-common';

import { ChatInput } from '../components/ChatInput';
import { EnhanceIcon } from '../components/Icon';
import { LineVertical } from '../components/lineVertical';
import { Thumbs } from '../components/Thumbs';

import * as styles from './ai-inline-chat.module.less';
import { AiInlineChatService, EChatStatus } from './ai-inline-chat.service';

export const AIInlineChatPanel = (props: { selectChangeFire: Emitter<string> }) => {
  const aiInlineChatService: AiInlineChatService = useInjectable(AiInlineChatService);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDone, setIsDone] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [currentCheckText, setCurrentCheckText] = useState<string>('优化代码');

  useEffect(() => {
    const dis = aiInlineChatService.onChatStatus((status) => {
      if (status === EChatStatus.THINKING) {
        setIsLoading(true);
        setIsDone(false);
        setIsError(false);
      } else {
        setIsLoading(false);
      }

      if (status === EChatStatus.DONE) {
        setIsDone(true);
        setIsError(false);
      } else {
        setIsDone(false);
      }

      if (status === EChatStatus.ERROR) {
        setIsLoading(false);
        setIsDone(false);
        setIsError(true);
      }
    });

    return () => {
      dis.dispose();
    };
  }, []);

  const improveList = useMemo(
    () => [
      { title: '解释代码', iconClass: getExternalIcon('git-pull-request') },
      { title: '生成注释', iconClass: getExternalIcon('git-pull-request') },
      { title: '优化代码', iconClass: getExternalIcon('git-pull-request') },
      { title: '生成测试用例', iconClass: getExternalIcon('git-pull-request') },
    ],
    [],
  );

  const renderHeader = useMemo(() => {
    if (!isLoading && !isDone) {
      return null;
    }

    return (
      <div className={styles.panel_header}>
        {/* 进度条 */}
        <span className={styles.progress_bar}>
          <Progress loading={!isDone} style={{ width: '25%' }} wrapperClassName='ai-native-progress-wrapper' />
        </span>
      </div>
    );
  }, [isLoading, isDone]);

  const renderResult = useMemo(() => {
    if (!isDone && !isError) {
      return null;
    }

    if (isLoading) {
      return null;
    }

    return (
      <div className={styles.panel_result}>
        <div className={styles.result_container}>
          {/* <div className={styles.title}>
            {!isLoading && isError ? (
              <span className={styles.error_text}>生成失败，请重试</span>
            ) : (
              <span>{currentCheckText}</span>
            )}
          </div> */}
          {isDone && (
            <>
              <div className={styles.operate}>
                <div className={styles.left_side}>
                  <Button
                    size={'small'}
                    onClick={() => {
                      aiInlineChatService._onAccept.fire();
                    }}
                  >
                    采纳
                  </Button>
                  <Button
                    size={'small'}
                    type={'ghost'}
                    onClick={() => {
                      aiInlineChatService._onDiscard.fire();
                    }}
                  >
                    丢弃
                  </Button>
                  <Button size={'small'} type={'ghost'}>
                    重新生成
                  </Button>
                </div>
                <div className={styles.right_side}>
                  <Thumbs />
                </div>
              </div>
              {/* <span className={styles.v_line}></span> */}
            </>
          )}
        </div>
      </div>
    );
  }, [isLoading, isDone, isError, aiInlineChatService]);

  const handleShortcutsClick = useCallback(
    (text: string) => {
      setInputValue(text);
    },
    [inputValue],
  );

  return (
    <div className={styles.ai_inline_chat_panel}>
      {/* header */}
      {renderHeader}
      {/* result */}
      {renderResult}
      {/* chat */}
      <div className={styles.panel_chat}>
        <div className={styles.ai_content_widget_input}>
          <ChatInput
            disabled={isLoading}
            onSend={(value) => {
              props.selectChangeFire.fire(value);
              setCurrentCheckText(value);
              setInputValue(value);
            }}
            onValueChange={(value) => {
              setInputValue(value);
            }}
            sendBtnClassName={styles.send_btn}
            defaultHeight={32}
            value={inputValue}
            placeholder={'请描述你的诉求'}
          />
        </div>
        <div className={styles.ai_shortcuts}>
          <ul className={styles.item_ul}>
            {improveList.map(({ title, iconClass }, i) => (
              <>
                {i !== 0 && <LineVertical />}
                <li className={styles.item_li}>
                  {iconClass && (
                    <EnhanceIcon
                      className={clsx(iconClass, styles.action_icon)}
                      wrapperStyle={{ padding: 6 }}
                      onClick={() => handleShortcutsClick(title)}
                    >
                      <span>{title}</span>
                    </EnhanceIcon>
                  )}
                </li>
              </>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
