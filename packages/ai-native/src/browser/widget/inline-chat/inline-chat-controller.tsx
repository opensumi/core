import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { IAIInlineChatService, useInjectable } from '@opensumi/ide-core-browser';
import { AIAction, AIInlineResult, EnhancePopover } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { ContentWidgetContainerPanel } from '@opensumi/ide-core-browser/lib/components/ai-native/content-widget/containerPanel';
import { MenuNode } from '@opensumi/ide-core-browser/lib/menu/next/base';
import { InlineChatFeatureRegistryToken, localize } from '@opensumi/ide-core-common';

import { Loading } from '../../components/Loading';

import { InlineChatFeatureRegistry } from './inline-chat.feature.registry';
import styles from './inline-chat.module.less';
import { AIInlineChatService, EInlineChatStatus } from './inline-chat.service';

export interface IAIInlineOperationProps {
  handleActions: (id: string) => void;
  onClose?: () => void;
}

const AIInlineOperation = (props: IAIInlineOperationProps) => {
  const { handleActions, onClose } = props;
  const inlineChatFeatureRegistry: InlineChatFeatureRegistry = useInjectable(InlineChatFeatureRegistryToken);

  const operationList = useMemo(() => inlineChatFeatureRegistry.getEditorActionButtons(), [inlineChatFeatureRegistry]);

  const handleClickActions = useCallback(
    (id: string) => {
      handleActions(id);
    },
    [handleActions],
  );

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const moreOperation = useMemo(
    () =>
      inlineChatFeatureRegistry.getEditorActionMenus().map(
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

export interface IAIInlineChatControllerProps {
  onClickActions: (id: string) => void;
  onClose?: () => void;
}

export const AIInlineChatController = (props: IAIInlineChatControllerProps) => {
  const { onClickActions, onClose } = props;
  const aiInlineChatService: AIInlineChatService = useInjectable(IAIInlineChatService);
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
        text: localize('aiNative.inline.chat.operate.check.title'),
        onClick: () => {
          aiInlineChatService._onAccept.fire();
        },
      },
      {
        icon: 'discard',
        text: localize('aiNative.operate.discard.title'),
        onClick: () => {
          aiInlineChatService._onDiscard.fire();
        },
      },
      {
        icon: 'afresh',
        text: localize('aiNative.operate.afresh.title'),
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
        onClickActions(id);
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
      return (
        <ContentWidgetContainerPanel style={{ transform: 'translateY(4px)' }}>
          <AIInlineResult iconItems={iconResultItems} />
        </ContentWidgetContainerPanel>
      );
    }

    if (isLoading) {
      return (
        <ContentWidgetContainerPanel>
          <EnhancePopover id={'inline_chat_loading'} title={localize('aiNative.inline.chat.operate.loading.cancel')}>
            <Loading className={styles.ai_inline_chat_loading} />
          </EnhancePopover>
        </ContentWidgetContainerPanel>
      );
    }

    return <AIInlineOperation handleActions={handleClickActions} onClose={onClose} />;
  }, [status]);

  return <div style={translateY}>{renderContent()}</div>;
};
