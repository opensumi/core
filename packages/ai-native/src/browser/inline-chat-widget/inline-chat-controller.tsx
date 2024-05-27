import debounce from 'lodash/debounce';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { message } from '@opensumi/ide-components';
import { IAiInlineChatService, useInjectable } from '@opensumi/ide-core-browser';
import { AIAction, AiInlineResult, EnhancePopover } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { MenuNode } from '@opensumi/ide-core-browser/lib/menu/next/base';
import { Emitter } from '@opensumi/ide-core-common';

import { AiResponseTips } from '../../common';
import { Loading } from '../components/Loading';
import { IInlineChatFeatureRegistry } from '../types';

import { InlineChatFeatureRegistry } from './inline-chat.feature.registry';
import styles from './inline-chat.module.less';
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
    <AIAction
      operationList={operationList}
      moreOperation={moreOperation}
      onClickItem={handleClickActions}
      onClose={handleClose}
    />
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
  const aiInlineChatService: AiInlineChatService = useInjectable(IAiInlineChatService);
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

  const iconResultItems = useMemo(
    () => [
      {
        icon: 'check',
        text: '采纳',
        onClick: () => {
          aiInlineChatService._onAccept.fire();
        },
      },
      {
        icon: 'diuqi',
        text: '丢弃',
        onClick: () => {
          aiInlineChatService._onDiscard.fire();
        },
      },
      {
        icon: 'zhongxin',
        text: '重新生成',
        onClick: () => {
          aiInlineChatService._onRegenerate.fire();
        },
      },
    ],
    [],
  );

  const handleClickActions = useCallback(
    (id: string) => {
      if (onClickActions) {
        onClickActions.fire(id);
      }
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
      return <AiInlineResult iconItems={iconResultItems} />;
    }

    if (isLoading) {
      return (
        <div className={styles.ai_inline_loading_panel}>
          <EnhancePopover id={'inline_chat_loading'} title={'按 ESC 取消'}>
            <Loading className={styles.ai_inline_chat_loading} />
          </EnhancePopover>
        </div>
      );
    }

    return <AiInlineOperation hanldeActions={handleClickActions} onClose={onClose} />;
  }, [status]);

  return <div style={translateY}>{renderContent()}</div>;
};
