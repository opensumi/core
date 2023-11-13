import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { MenuNode } from '@opensumi/ide-core-browser/lib/menu/next/base';
import { Emitter } from '@opensumi/ide-core-common';

import { AILogoAvatar, EnhanceIcon, EnhanceIconWithCtxMenu } from '../components/Icon';
import { LineVertical } from '../components/lineVertical';
import { Loading } from '../components/Loading';
import { EnhancePopover } from '../components/Popover';
import { Thumbs } from '../components/Thumbs';

import * as styles from './inline-chat.module.less';
import { AiInlineChatService, EInlineChatStatus } from './inline-chat.service';

export enum EInlineOperation {
  Explain = 'Explain',
  Comments = 'Comments',
  Test = 'Test',
  Optimize = 'Optimize',
}

export interface IAiInlineOperationProps {
  hanldeOperate: (d: EInlineOperation) => void;
  onClose?: () => void;
}

/**
 * 原始操作项
 */
const AiInlineOperation = (props: IAiInlineOperationProps) => {
  const { hanldeOperate, onClose } = props;

  const operationList = useMemo(
    () => [
      { title: EInlineOperation.Explain, popover: '解释代码' },
      { title: EInlineOperation.Comments, popover: '添加注释' },
      { title: EInlineOperation.Test, popover: '生成单测' },
    ],
    [],
  );

  const handleClickOperate = useCallback((title: EInlineOperation) => {
    hanldeOperate(title);
  }, []);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const moreOperation = useMemo(
    () => [
      new MenuNode({
        id: `ai.menu.operation.${EInlineOperation.Optimize}`,
        label: EInlineOperation.Optimize,
        className: styles.more_operation_menu_item,
        execute: () => {
          hanldeOperate(EInlineOperation.Optimize);
        },
      }),
    ],
    [],
  );

  return (
    <div className={styles.ai_inline_operation_panel}>
      <AILogoAvatar />
      <LineVertical margin={'0px 4px 0 8px'} />
      <div className={styles.operate_container}>
        {operationList.map(({ title, popover }) => (
          <EnhancePopover id={title} title={popover}>
            <EnhanceIcon onClick={() => handleClickOperate(title)}>
              <span>{title}</span>
            </EnhanceIcon>
          </EnhancePopover>
        ))}
        <EnhanceIconWithCtxMenu
          icon={'more'}
          menuNodes={moreOperation}
          skew={{
            x: -83,
            y: 5,
          }}
        />
        <div className={styles.close_container}>
          <LineVertical margin={'0px 4px 0 4px'} />
          <EnhanceIcon icon={'close'} onClick={handleClose} />
        </div>
      </div>
    </div>
  );
};

/**
 * 采纳、重新生成
 */
const AiInlineResult = () => {
  const aiInlineChatService: AiInlineChatService = useInjectable(AiInlineChatService);

  const handleAdopt = useCallback(() => {
    aiInlineChatService._onAccept.fire();
  }, []);

  const handleDiscard = useCallback(() => {
    aiInlineChatService._onDiscard.fire();
  }, []);

  const handleRefresh = useCallback(() => {
    aiInlineChatService._onRegenerate.fire();
  }, []);

  return (
    <div className={styles.ai_inline_result_panel}>
      <div className={styles.side} style={{ marginRight: 128 }}>
        <EnhanceIcon icon={'check'} onClick={handleAdopt}>
          <span>采纳</span>
        </EnhanceIcon>
        <EnhanceIcon icon={'revoke'} onClick={handleDiscard}>
          <span>丢弃</span>
        </EnhanceIcon>
        <EnhanceIcon icon={'refresh'} onClick={handleRefresh}>
          <span>重新生成</span>
        </EnhanceIcon>
      </div>
      <div className={styles.side}>
        <Thumbs />
      </div>
    </div>
  );
};

export interface IAiInlineChatControllerProps {
  onClickOperation: Emitter<EInlineOperation>;
  onClose?: () => void;
}

export const AiInlineChatController = (props: IAiInlineChatControllerProps) => {
  const { onClickOperation, onClose } = props;
  const aiInlineChatService: AiInlineChatService = useInjectable(AiInlineChatService);
  const [status, setStatus] = useState<EInlineChatStatus>(EInlineChatStatus.READY);

  useEffect(() => {
    const dis = aiInlineChatService.onChatStatus((status) => {
      setStatus(status);
    });

    return () => {
      dis.dispose();
    };
  }, []);

  const isLoading = useMemo(() => status === EInlineChatStatus.THINKING, [status]);
  const isDone = useMemo(() => status === EInlineChatStatus.DONE, [status]);
  const isError = useMemo(() => status === EInlineChatStatus.ERROR, [status]);

  const handleClickOperation = useCallback(
    (title: EInlineOperation) => {
      onClickOperation.fire(title);
    },
    [onClickOperation],
  );

  const translateY: React.CSSProperties | undefined = useMemo(() => {
    if (isDone) {
      return {
        transform: 'translateY(-15px)',
      };
    }
    return undefined;
  }, [isDone]);

  const renderContent = useCallback(() => {
    if (isError) {
      return (
        <div className={styles.ai_inline_error_result_panel}>
          <span>当前与我互动的人太多请稍后再试，感谢您的理解与支持</span>
        </div>
      );
    }

    if (isDone) {
      return <AiInlineResult />;
    }

    if (isLoading) {
      return <Loading className={styles.ai_inline_chat_loading} />;
    }

    return <AiInlineOperation hanldeOperate={handleClickOperation} onClose={onClose} />;
  }, [status]);

  return (
    <div className={styles.ai_inline_chat_controller_panel} style={translateY}>
      {renderContent()}
    </div>
  );
};
