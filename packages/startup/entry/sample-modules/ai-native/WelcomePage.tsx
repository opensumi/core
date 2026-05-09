import React from 'react';

import { ChatWelcomePageRender } from '@opensumi/ide-ai-native/lib/browser/types';
import { getIcon } from '@opensumi/ide-core-browser';
import { Icon } from '@opensumi/ide-core-browser/lib/components';
import { localize } from '@opensumi/ide-core-common';

import styles from './WelcomePage.module.less';

interface IWelcomePageProps {
  onSend: (message: string, images?: string[], agentId?: string, command?: string) => void;
  agentId?: string;
  setAgentId: (id: string) => void;
  command?: string;
  setCommand: (cmd: string) => void;
}

export const ExampleWelcomePage: React.FC<IWelcomePageProps> = ({ onSend }) => {
  const handleSampleClick = (message: string) => {
    onSend(message);
  };

  return (
    <div className={styles.welcome_container}>
      <div className={styles.welcome_header}>
        <Icon className={getIcon('ai')} style={{ fontSize: '48px', color: 'var(--design-text-foreground)' }} />
        <h2 className={styles.welcome_title}>{localize('aiNative.chat.ai.assistant.name')}</h2>
        <p className={styles.welcome_desc}>
          {localize('aiNative.chat.welcome.loading.text') || 'Your AI-powered coding assistant'}
        </p>
      </div>

      <div className={styles.sample_questions}>
        <div className={styles.sample_card} onClick={() => handleSampleClick('Explain my code')}>
          <Icon className={getIcon('search')} />
          <span>Explain my code</span>
        </div>
        <div className={styles.sample_card} onClick={() => handleSampleClick('Optimize my code')}>
          <Icon className={getIcon('rocket')} />
          <span>Optimize my code</span>
        </div>
        <div className={styles.sample_card} onClick={() => handleSampleClick('Generate unit tests')}>
          <Icon className={getIcon('check')} />
          <span>Generate unit tests</span>
        </div>
        <div className={styles.sample_card} onClick={() => handleSampleClick('Find and fix bugs')}>
          <Icon className={getIcon('wrench')} />
          <span>Find and fix bugs</span>
        </div>
      </div>
    </div>
  );
};

export const exampleWelcomePageRender: ChatWelcomePageRender = (props) => <ExampleWelcomePage {...props} />;
