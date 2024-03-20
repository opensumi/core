import React, { useCallback, useState } from 'react';

import {
  AIActionItem,
  AILogoAvatar,
  EnhanceIcon,
  EnhanceIconWithCtxMenu,
  EnhancePopover,
  LineVertical,
} from '@opensumi/ide-core-browser/lib/components/ai-native';

import baseStyles from '../../widget/inline-chat/inline-chat.module.less';

import styles from './terminal-inline-chat-controller.module.less';

export interface IAiInlineOperationProps {
  hanldeActions: (id: string) => void;
  onClose?: () => void;
  options: AIActionItem[];
}

/**
 * 基于 Opensumi inlineChatController 修改，适应终端的使用环境
 */
export const AiInlineOperation = (props: IAiInlineOperationProps) => {
  const { hanldeActions, onClose, options } = props;

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

  const moreOperation: string | any[] = [];

  if (options.length === 0 && moreOperation.length === 0) {
    return null;
  }

  return (
    <div className={baseStyles.ai_inline_operation_panel}>
      <AILogoAvatar />
      <LineVertical height={'60%'} margin={'0px 4px 0 8px'} />
      <div className={baseStyles.operate_container}>
        {options.map(({ name, title, id }, i) => (
          <EnhancePopover id={id} title={title} key={`popover_${i}`}>
            <EnhanceIcon wrapperClassName={baseStyles.operate_item} onClick={() => handleClickActions(id)}>
              <span key={i}>{name}</span>
            </EnhanceIcon>
          </EnhancePopover>
        ))}
        {moreOperation.length > 0 && (
          <EnhanceIconWithCtxMenu
            icon={'more'}
            menuNodes={moreOperation}
            skew={{
              x: -83,
              y: 5,
            }}
          />
        )}
        {onClose && (
          <div className={baseStyles.close_container}>
            <LineVertical height={'60%'} margin={'0px 4px 0 4px'} />
            <EnhanceIcon icon={'close'} onClick={handleClose} wrapperClassName={baseStyles.operate_item} />
          </div>
        )}
      </div>
    </div>
  );
};

// 右上角的 AI 操作按钮
export const AiInlineWidgetForSelection = (props: IAiInlineOperationProps) => {
  const [displayAIButton, setDisplayAIButton] = useState(true);

  return (
    <div className={styles['terminal-inline-chat']} style={{ display: displayAIButton ? 'block' : 'none' }}>
      <AiInlineOperation
        {...props}
        onClose={() => {
          setDisplayAIButton(false);
        }}
      />
    </div>
  );
};

// 右上角的 AI 操作按钮，用于自动检测的场景
export const AiInlineWidgetForAutoDelect = (props: IAiInlineOperationProps) => {
  const [displayAIButton, setDisplayAIButton] = useState(false);

  return (
    <div
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
        setDisplayAIButton(true);
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = '';
        setDisplayAIButton(false);
      }}
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      <div className={styles['terminal-inline-chat']} style={{ display: displayAIButton ? 'block' : 'none' }}>
        <AiInlineOperation {...props} />
      </div>
    </div>
  );
};
