import React, { useEffect, useMemo, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { ChatFeatureRegistryToken, localize } from '@opensumi/ide-core-common';

import { IChatInternalService } from '../../../common';
import { ChatFeatureRegistry } from '../../chat/chat.feature.registry';
import { AcpChatInternalService, type AcpSkillCatalogState } from '../../chat/chat.internal.service.acp';
import styles from '../../components/components.module.less';

export function AcpSlashCommandFooter() {
  const chatFeatureRegistry = useInjectable<ChatFeatureRegistry>(ChatFeatureRegistryToken);
  const aiChatService = useInjectable<AcpChatInternalService>(IChatInternalService);

  const slashCommands = useMemo(() => chatFeatureRegistry.getAllSlashCommand(), [chatFeatureRegistry]);
  const [skillCatalogState, setSkillCatalogState] = useState<AcpSkillCatalogState>(aiChatService.getSkillCatalogState());

  useEffect(() => {
    const disposable = aiChatService.onSkillCatalogStateChange(setSkillCatalogState);
    return () => disposable.dispose();
  }, [aiChatService]);

  const handleTriggerClick = () => {
    window.dispatchEvent(new CustomEvent('opensumi-chat-input-open-slash-panel'));
  };

  if (skillCatalogState === 'pending') {
    return (
      <div className={styles.slash_command_container} data-testid='acp-skills-loading'>
        {localize('aiNative.chat.acp.skills.loading', 'Skills loading…')}
      </div>
    );
  }

  if (skillCatalogState === 'empty') {
    return (
      <div className={styles.slash_command_container} data-testid='acp-no-skills'>
        {localize('aiNative.chat.acp.skills.empty', 'No Skills')}
      </div>
    );
  }

  if (slashCommands.length === 0 && aiChatService.getAvailableCommands().length === 0) {
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
