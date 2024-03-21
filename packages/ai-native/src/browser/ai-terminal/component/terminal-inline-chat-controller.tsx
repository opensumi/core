import React, { useMemo, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { AIAction, AIActionItem } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { InlineChatFeatureRegistryToken } from '@opensumi/ide-core-common';

import { InlineChatFeatureRegistry } from '../../widget/inline-chat/inline-chat.feature.registry';

import styles from './terminal-inline-chat-controller.module.less';

interface ITerminalInlineWidgetProps {
  actions: AIActionItem[];
  onClickItem: (id: string) => void;
}

export const TerminalInlineWidgetForSelection = ({ actions, onClickItem }: ITerminalInlineWidgetProps) => (
  <div className={styles.terminal_inline_chat}>
    <AIAction operationList={actions} onClickItem={onClickItem} />
  </div>
);

export const TerminalInlineWidgetForDelect = ({ actions, onClickItem }: ITerminalInlineWidgetProps) => {
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
      <div className={styles.terminal_inline_chat} style={{ display: displayAIButton ? 'block' : 'none' }}>
        <AIAction operationList={actions} onClickItem={onClickItem} />
      </div>
    </div>
  );
};
