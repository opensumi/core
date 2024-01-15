import { debounce } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { message } from '@opensumi/ide-components';
import { useInjectable } from '@opensumi/ide-core-browser';
import { MenuNode } from '@opensumi/ide-core-browser/lib/menu/next/base';
import { Emitter } from '@opensumi/ide-core-common';

import { AiResponseTips } from '../../common';
import { AILogoAvatar, EnhanceIcon, EnhanceIconWithCtxMenu } from '../components/Icon';
import { LineVertical } from '../components/lineVertical';
import { Loading } from '../components/Loading';
import { EnhancePopover } from '../components/Popover';
import { Thumbs } from '../components/Thumbs';
import { IInlineChatFeatureRegistry } from '../types';

import { InlineChatFeatureRegistry } from './inline-chat.feature.registry';
import * as styles from './inline-chat.module.less';
import { AiInlineChatService, EInlineChatStatus } from './inline-chat.service';

export interface IAiInlineOperationProps {
  hanldeActions: (id: string) => void;
  onClose?: () => void;
}

/**
 * 原始操作项
 */
const AiInlineOperation = (props: IAiInlineOperationProps) => {
  const { hanldeActions, onClose } = props;
  const inlineChatFeatureRegistry: InlineChatFeatureRegistry = useInjectable(IInlineChatFeatureRegistry);

  const operationList = useMemo(() => inlineChatFeatureRegistry.getActionButtons(), [inlineChatFeatureRegistry]);

  const handleClickActions = useCallback(
    (id: string) => {
      hanldeActions(id);
    },
    [hanldeActions],
  );

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const moreOperation = useMemo(
    () =>
      inlineChatFeatureRegistry.getActionMenus().map(
        (data) =>
          new MenuNode({
            id: `ai.menu.operation.${data.id}`,
            label: data.name,
            className: styles.more_operation_menu_item,
            execute: () => {
              handleClickActions(data.id);
            },
          }),
      ),
    [inlineChatFeatureRegistry],
  );

  if (operationList.length === 0 && moreOperation.length === 0) {
    return null;
  }

  return (
    <div className={styles.ai_inline_operation_panel}>
      <AILogoAvatar />
      <LineVertical height={'70%'} margin={'0px 4px 0 8px'} />
      <div className={styles.operate_container}>
        {operationList.map(({ name, title, id }, i) => (
          <EnhancePopover id={id} title={title} key={`popover_${i}`}>
            <EnhanceIcon wrapperClassName={styles.operate_item} onClick={() => handleClickActions(id)}>
              <span key={i}>{name}</span>
            </EnhanceIcon>
          </EnhancePopover>
        ))}
        {moreOperation.length > 0 && (
          <EnhanceIconWithCtxMenu
            icon={'more'}
            menuNodes={moreOperation}
            wrapperClassName={styles.operate_item}
            skew={{
              x: -83,
              y: 5,
            }}
          />
        )}
        <div className={styles.close_container}>
          <LineVertical height={'60%'} margin={'0px 6px 0 6px'} />
          <EnhanceIcon icon={'window-close'} onClick={handleClose} wrapperClassName={styles.operate_item} />
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

  const handleThumbs = useCallback((islike: boolean) => {
    aiInlineChatService._onThumbs.fire(islike);
  }, []);

  return (
    <div className={styles.ai_inline_result_panel}>
      <div className={styles.side}>
        <EnhanceIcon wrapperClassName={styles.operate_btn} icon={'check'} onClick={handleAdopt}>
          <span>采纳</span>
        </EnhanceIcon>
        <EnhanceIcon wrapperClassName={styles.operate_btn} icon={'diuqi'} onClick={handleDiscard}>
          <span>丢弃</span>
        </EnhanceIcon>
        <EnhanceIcon wrapperClassName={styles.operate_btn} icon={'zhongxin'} onClick={handleRefresh}>
          <span>重新生成</span>
        </EnhanceIcon>
      </div>
      <LineVertical height={'60%'} margin={'0px 6px 0 6px'} />
      <div className={styles.side}>
        <Thumbs wrapperClassName={styles.operate_icon} onClick={handleThumbs} />
      </div>
    </div>
  );
};

export interface IAiInlineChatControllerProps {
  onClickActions: Emitter<string>;
  onClose?: () => void;
}

const debounceMessage = debounce(() => {
  message.info(AiResponseTips.ERROR_RESPONSE);
}, 1000);

export const AiInlineChatController = (props: IAiInlineChatControllerProps) => {
  const { onClickActions, onClose } = props;
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

  useEffect(() => {
    if (status === EInlineChatStatus.ERROR) {
      debounceMessage();
      if (onClose) {
        onClose();
      }
    }
  }, [status, onClose]);

  const isLoading = useMemo(() => status === EInlineChatStatus.THINKING, [status]);
  const isDone = useMemo(() => status === EInlineChatStatus.DONE, [status]);
  const isError = useMemo(() => status === EInlineChatStatus.ERROR, [status]);

  const handleClickActions = useCallback(
    (id: string) => {
      onClickActions.fire(id);
    },
    [onClickActions],
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
      return null;
    }

    if (isDone) {
      return <AiInlineResult />;
    }

    if (isLoading) {
      return (
        <EnhancePopover id={'inline_chat_loading'} title={'按 ESC 取消'}>
          <Loading className={styles.ai_inline_chat_loading} />
        </EnhancePopover>
      );
    }

    return <AiInlineOperation hanldeActions={handleClickActions} onClose={onClose} />;
  }, [status]);

  return (
    <div className={styles.ai_inline_chat_controller_panel} style={translateY}>
      {renderContent()}
    </div>
  );
};
