import React, { useState } from 'react';

import { AIAction, AIActionItem } from '@opensumi/ide-core-browser/lib/components/ai-native';

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

export const TerminalInlineWidgetForDetection = ({ actions, onClickItem }: ITerminalInlineWidgetProps) => {
  const [displayAIButton, setDisplayAIButton] = useState(false);

  return (
    <div
      onMouseOver={(e) => {
        setDisplayAIButton(true);
        e.currentTarget.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
      }}
      onMouseOut={(e) => {
        setDisplayAIButton(false);
        e.currentTarget.style.backgroundColor = '';
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
