import React, { useEffect, useMemo, useState } from 'react';

import { getIcon, useInjectable } from '@opensumi/ide-core-browser';
import { getExternalIcon } from '@opensumi/ide-core-browser';
import { Button, Icon } from '@opensumi/ide-core-browser/lib/components/index';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';
import { Emitter } from '@opensumi/ide-core-common';

import { AIImprove } from '../components/AIImprove';
import { ChatInput } from '../components/ChatInput';

import * as styles from './ai-inline-chat.module.less';
import { AiInlineChatService, EChatStatus } from './ai-inline-chat.service';

export const AIInlineChatPanel = (props: { selectChangeFire: Emitter<string> }) => {
  const aiInlineChatService: AiInlineChatService = useInjectable(AiInlineChatService);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDone, setIsDone] = useState<boolean>(false);
  const [currentCheckText, setCurrentCheckText] = useState<string>('优化代码');

  useEffect(() => {
    const dis = aiInlineChatService.onChatStatus((status) => {
      if (status === EChatStatus.THINKING) {
        setIsLoading(true);
        setIsDone(false);
      } else {
        setIsLoading(false);
      }

      if (status === EChatStatus.DONE) {
        setIsDone(true);
      } else {
        setIsDone(false);
      }

      if (status === EChatStatus.ERROR) {
        setIsLoading(false);
        setIsDone(false);
      }
    });

    return () => {
      dis.dispose();
    };
  }, []);

  const improveList = useMemo(
    () => [
      { title: '解释代码', iconClass: getExternalIcon('git-pull-request') },
      { title: '｜', iconClass: '' },
      { title: '生成注释', iconClass: getExternalIcon('git-pull-request') },
      { title: '｜', iconClass: '' },
      { title: '优化代码', iconClass: getExternalIcon('git-pull-request') },
      { title: '｜', iconClass: '' },
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
        <div className={styles.header_container}>
          <div className={styles.left_side}>
            <span>Chat</span>
          </div>
          <div className={styles.right_side}>
            <Icon className={getIcon('clear')} style={{ marginRight: '8px' }} />
            <Icon className={getIcon('close')} />
          </div>
        </div>
        {/* 进度条 */}
        <span className={styles.progress_bar}>
          <Progress loading={!isDone} />
        </span>
      </div>
    );
  }, [isLoading, isDone]);

  const renderResult = useMemo(() => {
    if (!isLoading && !isDone) {
      return null;
    }

    return (
      <div className={styles.panel_result}>
        <div className={styles.result_container}>
          <div className={styles.title}>
            <Icon />
            <span>{currentCheckText}</span>
          </div>
          {isDone && (
            <>
              <span className={styles.v_line}></span>
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
                </div>
                <div className={styles.right_side}>
                  <Button size={'small'}>
                    <Icon className={getIcon('layout')} />
                  </Button>
                  <span>｜</span>
                  <Icon className={getExternalIcon('thumbsup')} />
                  <Icon className={getExternalIcon('thumbsdown')} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }, [isLoading, isDone, aiInlineChatService]);

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
            onSend={(value) => {
              props.selectChangeFire.fire(value);
              setCurrentCheckText(value);
            }}
            placeholder={'请描述你的诉求'}
          />
        </div>
        <div className={styles.ai_shortcuts}>
          <AIImprove
            onClick={(title) => {
              props.selectChangeFire.fire(title);
              setCurrentCheckText(title);
            }}
            lists={improveList}
          />
        </div>
      </div>
    </div>
  );
};
