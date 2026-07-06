import React from 'react';

import { COMMON_COMMANDS, PreferenceService, getIcon, localize, useInjectable } from '@opensumi/ide-core-browser';
import {
  ACPAgentType,
  AgentConfig,
  ChatMessageRole,
  CommandService,
  DEFAULT_AGENT_TYPE,
  PreferenceScope,
} from '@opensumi/ide-core-common';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings/ai-native';
import { IMessageService } from '@opensumi/ide-overlay';

import { cleanAttachedTextWrapper } from '../../common/utils';
import { AIPanelLayoutService } from '../layout/panel-layout.service';

import { AgenticChatHeaderMaximizeAction } from './AgenticChatHeaderMaximizeAction';
import { ChatModel } from './chat-model';
import styles from './chat.module.less';
import { getAvailableAgentConfigs, getDefaultAgentType } from './get-default-agent-type';

const MAX_TITLE_LENGTH = 100;

const AGENT_TYPE_LABELS: Record<string, { label: string; title: string }> = {
  'claude-agent-acp': {
    label: 'Claude',
    title: 'Claude Code ACP',
  },
  qwen: {
    label: 'Qwen',
    title: 'Qwen',
  },
};

interface AgentSelectorOption {
  value: ACPAgentType;
  label: string;
  title: string;
}

function getAgentSelectorOptions(preferenceService: PreferenceService): AgentSelectorOption[] {
  const configs = getAvailableAgentConfigs(preferenceService);
  return Object.entries(configs).map(([agentType, config]) => {
    const builtInLabel = AGENT_TYPE_LABELS[agentType];
    return {
      value: agentType as ACPAgentType,
      label: builtInLabel?.label || config.description || agentType,
      title: builtInLabel?.title || getAgentConfigTitle(agentType, config),
    };
  });
}

function getAgentConfigTitle(agentType: string, config: AgentConfig): string {
  return config.command ? `${agentType} · ${config.command}` : agentType;
}

export function getAgenticChatPanelTitle(sessionModel: ChatModel | undefined, preferSessionTitle = false): string {
  if (preferSessionTitle && sessionModel?.title) {
    return sessionModel.title.slice(0, MAX_TITLE_LENGTH);
  }

  const messages = sessionModel?.history.getMessages() || [];
  const latestUserMessage = [...messages].find((message) => message.role === ChatMessageRole.User);
  const messageTitle = latestUserMessage
    ? cleanAttachedTextWrapper(latestUserMessage.content).slice(0, MAX_TITLE_LENGTH)
    : '';

  return messageTitle || localize('aiNative.chat.ai.assistant.name');
}

export function AgenticChatPanelHeader({
  preferSessionTitle = false,
  sessionModel,
}: {
  preferSessionTitle?: boolean;
  sessionModel?: ChatModel;
}) {
  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);
  const [panelLayout, setPanelLayout] = React.useState(() => panelLayoutService.getLayoutMode());
  const [title, setTitle] = React.useState(() => getAgenticChatPanelTitle(sessionModel, preferSessionTitle));

  const refreshTitle = React.useCallback(() => {
    setTitle(getAgenticChatPanelTitle(sessionModel, preferSessionTitle));
  }, [preferSessionTitle, sessionModel]);

  React.useEffect(() => {
    setPanelLayout(panelLayoutService.getLayoutMode());
    const disposable = panelLayoutService.onDidChangePanelLayout((mode) => {
      setPanelLayout(mode);
    });

    return () => disposable.dispose();
  }, [panelLayoutService]);

  React.useEffect(() => {
    refreshTitle();
    const disposable = sessionModel?.history.onMessageChange(refreshTitle);

    return () => disposable?.dispose();
  }, [refreshTitle, sessionModel]);

  if (panelLayout !== 'agentic') {
    return null;
  }

  return (
    <div className={styles.agentic_chat_panel_header} data-testid='agentic-chat-panel-header'>
      <div className={styles.agentic_chat_panel_title} data-testid='agentic-chat-panel-header-title' title={title}>
        {title}
      </div>
      <div className={styles.agentic_chat_panel_actions}>
        <AgenticChatHeaderAgentSelector />
        <AgenticChatHeaderMaximizeAction id='agentic-chat-panel-header-maximize' />
      </div>
    </div>
  );
}

export function AgenticChatHeaderAgentSelector() {
  const preferenceService = useInjectable<PreferenceService>(PreferenceService);
  const commandService = useInjectable<CommandService>(CommandService);
  const messageService = useInjectable<IMessageService>(IMessageService);
  const [agentOptions, setAgentOptions] = React.useState<AgentSelectorOption[]>(() =>
    getAgentSelectorOptions(preferenceService),
  );
  const [agentType, setAgentType] = React.useState<ACPAgentType>(() => getDefaultAgentType(preferenceService));
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const closeMenuTimerRef = React.useRef<number | undefined>(undefined);

  const refreshAgentSelector = React.useCallback(() => {
    setAgentOptions(getAgentSelectorOptions(preferenceService));
    setAgentType(getDefaultAgentType(preferenceService));
  }, [preferenceService]);

  React.useEffect(() => {
    const defaultTypeDisposable = preferenceService.onSpecificPreferenceChange?.(
      AINativeSettingSectionsId.DefaultAgentType,
      refreshAgentSelector,
    );
    const agentConfigDisposable = preferenceService.onSpecificPreferenceChange?.(
      AINativeSettingSectionsId.AgentConfigs,
      refreshAgentSelector,
    );

    return () => {
      defaultTypeDisposable?.dispose();
      agentConfigDisposable?.dispose();
    };
  }, [preferenceService, refreshAgentSelector]);

  const handleAgentTypeChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextAgentType = event.target.value as ACPAgentType;
      setAgentType(nextAgentType);
      await preferenceService.set(AINativeSettingSectionsId.DefaultAgentType, nextAgentType, PreferenceScope.User);
      messageService.info?.(localize('aiNative.chat.agentSelector.appliesToNewChats', 'Applies to new chats'));
    },
    [messageService, preferenceService],
  );

  const openMenu = React.useCallback(() => {
    if (closeMenuTimerRef.current) {
      window.clearTimeout(closeMenuTimerRef.current);
      closeMenuTimerRef.current = undefined;
    }
    setIsMenuOpen(true);
  }, []);

  const closeMenu = React.useCallback(() => {
    closeMenuTimerRef.current = window.setTimeout(() => {
      setIsMenuOpen(false);
      closeMenuTimerRef.current = undefined;
    }, 120);
  }, []);

  React.useEffect(
    () => () => {
      if (closeMenuTimerRef.current) {
        window.clearTimeout(closeMenuTimerRef.current);
      }
    },
    [],
  );

  const toggleMenu = React.useCallback(() => {
    setIsMenuOpen((open) => !open);
  }, []);

  const handleOpenAgentConfigurations = React.useCallback(() => {
    setIsMenuOpen(false);
    commandService.executeCommand(COMMON_COMMANDS.OPEN_PREFERENCES.id, AINativeSettingSectionsId.AgentConfigs);
  }, [commandService]);

  const selectedAgent = agentOptions.find((option) => option.value === agentType) || agentOptions[0];
  const tooltip = localize(
    'aiNative.chat.agentSelector.tooltip',
    '{0} · Applies to new chats',
    selectedAgent?.title || DEFAULT_AGENT_TYPE,
  );

  return (
    <div className={styles.agentic_chat_agent_selector_group}>
      <select
        aria-label={localize('aiNative.chat.agentSelector.label', 'Agent')}
        className={styles.agentic_chat_agent_selector}
        data-testid='agentic-chat-agent-selector'
        onChange={handleAgentTypeChange}
        title={tooltip}
        value={selectedAgent?.value || DEFAULT_AGENT_TYPE}
      >
        {agentOptions.map((option) => (
          <option key={option.value} title={option.title} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className={styles.agentic_chat_agent_config_menu_container} onMouseEnter={openMenu} onMouseLeave={closeMenu}>
        <button
          aria-expanded={isMenuOpen}
          aria-haspopup='menu'
          aria-label={localize('aiNative.chat.agentSelector.moreActions', 'Agent actions')}
          className={styles.agentic_chat_agent_config_button}
          data-testid='agentic-chat-agent-config-button'
          onClick={toggleMenu}
          title={localize('aiNative.chat.agentSelector.moreActions', 'Agent actions')}
          type='button'
        >
          <span className={getIcon('ellipsis')} />
        </button>
        {isMenuOpen && (
          <div
            className={styles.agentic_chat_agent_config_menu}
            data-testid='agentic-chat-agent-config-menu'
            role='menu'
          >
            <button
              className={styles.agentic_chat_agent_config_menu_item}
              data-testid='agentic-chat-agent-config-menu-item'
              onClick={handleOpenAgentConfigurations}
              role='menuitem'
              type='button'
            >
              {localize('aiNative.chat.agentSelector.configureAgents', 'Agent Configurations')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
