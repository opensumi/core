import React, { useMemo } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { ChatFeatureRegistryToken } from '@opensumi/ide-core-common';

import { ChatFeatureRegistry } from '../../chat/chat.feature.registry';
import styles from '../../components/components.module.less';

export function AcpSlashCommandFooter() {
  const chatFeatureRegistry = useInjectable<ChatFeatureRegistry>(ChatFeatureRegistryToken);

  const slashCommands = useMemo(() => chatFeatureRegistry.getAllSlashCommand(), [chatFeatureRegistry]);

  const handleTriggerClick = () => {
    window.dispatchEvent(new CustomEvent('opensumi-chat-input-open-slash-panel'));
  };

  if (slashCommands.length === 0) {
    return null;
  }

  return (
    <div className={styles.slash_command_container}>
      <span className={styles.slash_command_trigger} onClick={handleTriggerClick}>
        /
      </span>
    </div>
  );
}
