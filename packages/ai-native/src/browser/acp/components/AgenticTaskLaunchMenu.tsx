import React from 'react';

import {
  COMMON_COMMANDS,
  CommandService,
  PreferenceService,
  getIcon,
  localize,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { PreferenceScope } from '@opensumi/ide-core-common';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings/ai-native';
import { strings } from '@opensumi/ide-utils';

import { AI_CHAT_NEW_TASK } from '../../chat/acp-new-draft.commands';
import chatStyles from '../../chat/chat.module.less';
import {
  getAvailableAgentConfigs,
  getConfiguredAgentConfigs,
  getDefaultAgentType,
} from '../../chat/get-default-agent-type';
import { useCommandKeybindingLabel } from '../../chat/use-command-keybinding-label';
import { AgenticProjectRecord } from '../agentic-task-registry.service';
import { AgenticWorkspaceSwitchService } from '../agentic-workspace-switch.service';

import styles from './agentic-task-list.module.less';

export interface AgenticTaskLaunchMenuProps {
  project?: AgenticProjectRecord;
  projectLabel?: string;
  preferredAgentId?: string;
  variant?: 'task-list' | 'chat-header';
}

interface AgentOption {
  id: string;
  label: string;
  title: string;
}

function getAgentOptions(preferenceService: PreferenceService): AgentOption[] {
  return Object.entries(getConfiguredAgentConfigs(preferenceService)).map(([id, config]) => ({
    id,
    label: config.description || id,
    title: config.command ? `${id} · ${config.command}` : id,
  }));
}

export function AgenticTaskLaunchMenu({
  project,
  projectLabel,
  preferredAgentId,
  variant = 'task-list',
}: AgenticTaskLaunchMenuProps) {
  const workspaceSwitch = useInjectable<AgenticWorkspaceSwitchService>(AgenticWorkspaceSwitchService);
  const preferenceService = useInjectable<PreferenceService>(PreferenceService);
  const commandService = useInjectable<CommandService>(CommandService);
  const [agentMenuOpen, setAgentMenuOpen] = React.useState(false);
  const [launching, setLaunching] = React.useState(() => workspaceSwitch.isTaskLaunchPending);
  const isChatHeader = variant === 'chat-header';
  const newTaskKeybinding = useCommandKeybindingLabel(AI_CHAT_NEW_TASK.id);
  const [agentOptions, setAgentOptions] = React.useState(() => getAgentOptions(preferenceService));
  const refreshAgentOptions = React.useCallback(() => {
    setAgentOptions(getAgentOptions(preferenceService));
  }, [preferenceService]);

  React.useEffect(() => {
    refreshAgentOptions();
    const agentConfigsDisposable = preferenceService.onSpecificPreferenceChange?.(
      AINativeSettingSectionsId.AgentConfigs,
      refreshAgentOptions,
    );
    const defaultAgentDisposable = preferenceService.onSpecificPreferenceChange?.(
      AINativeSettingSectionsId.DefaultAgentType,
      refreshAgentOptions,
    );
    return () => {
      agentConfigsDisposable?.dispose();
      defaultAgentDisposable?.dispose();
    };
  }, [preferenceService, refreshAgentOptions]);

  React.useEffect(() => {
    const disposable = workspaceSwitch.onDidChangeTaskLaunchPending((pending) => setLaunching(pending));
    return () => disposable.dispose();
  }, [workspaceSwitch]);

  const projectAvailable = !!project && project.availability === 'available';
  const available = projectAvailable && agentOptions.length > 0;
  const preferredAvailableAgentId =
    [project?.lastAgentId, preferredAgentId, getDefaultAgentType(preferenceService)].find(
      (agentId): agentId is string => !!agentId && agentOptions.some((agent) => agent.id === agentId),
    ) ?? agentOptions[0]?.id;

  const launch = React.useCallback(
    async (agentId = preferredAvailableAgentId) => {
      if (launching || !project || !agentId || project.availability === 'unavailable') {
        return;
      }
      if (isChatHeader) {
        setAgentMenuOpen(false);
        await commandService.executeCommand(AI_CHAT_NEW_TASK.id, agentId);
        return;
      }
      const launched = await workspaceSwitch.launchTask(project, agentId);
      if (launched) {
        setAgentMenuOpen(false);
      }
    },
    [commandService, isChatHeader, launching, preferredAvailableAgentId, project, workspaceSwitch],
  );

  const openAgentConfigurations = React.useCallback(async () => {
    setAgentMenuOpen(false);
    try {
      await preferenceService.set(
        AINativeSettingSectionsId.AgentConfigs,
        getAvailableAgentConfigs(preferenceService),
        PreferenceScope.User,
      );
    } finally {
      commandService.executeCommand(COMMON_COMMANDS.OPEN_PREFERENCES.id, AINativeSettingSectionsId.AgentConfigs);
    }
  }, [commandService, preferenceService]);

  if (!isChatHeader) {
    const targetLabel =
      projectLabel ||
      project?.label ||
      project?.workspacePath ||
      localize('aiNative.agentic.project.fallbackName', 'Project');
    const launchTitle = strings.format(localize('aiNative.agentic.project.newTask', 'New Task for {0}'), targetLabel);
    return (
      <div className={styles.launch_menu_group}>
        <button
          aria-label={launchTitle}
          className={styles.project_new_task}
          data-testid='agentic-task-launch-button'
          disabled={!available || launching}
          onClick={() => void launch()}
          title={available ? launchTitle : localize('aiNative.chat.newTask.noAgent', 'No ACP Agent available')}
          type='button'
        >
          <span aria-hidden='true' className='codicon codicon-add' />
        </button>
      </div>
    );
  }

  const selectedAgent = agentOptions.find((agent) => agent.id === preferredAvailableAgentId);
  const chooseAgentLabel = localize('aiNative.chat.newTask.chooseAgent', 'Choose Agent');
  const launchTitle = !projectAvailable
    ? localize('aiNative.chat.newTask.workspaceUnavailable', 'Workspace Target unavailable')
    : !selectedAgent
    ? localize('aiNative.chat.newTask.noAgent', 'No ACP Agent available')
    : `${strings.format(localize('aiNative.chat.newTask.withAgent', 'New Task with {0}'), selectedAgent.label)}${
        newTaskKeybinding ? ` (${newTaskKeybinding})` : ''
      }`;

  return (
    <div className={chatStyles.agentic_task_launch_menu_group}>
      <button
        aria-label={launchTitle}
        aria-busy={launching}
        className={`${chatStyles.agentic_task_launch_button} ${chatStyles.agentic_task_launch_primary_button}`}
        data-testid='agentic-task-launch-button'
        disabled={!available || launching}
        onClick={() => void launch()}
        title={launchTitle}
        type='button'
      >
        <span
          aria-hidden='true'
          className={`codicon ${launching ? 'codicon-loading codicon-modifier-spin' : 'codicon-add'}`}
        />
      </button>
      <button
        aria-label={chooseAgentLabel}
        aria-expanded={agentMenuOpen}
        aria-haspopup='menu'
        className={`${chatStyles.agentic_task_launch_button} ${chatStyles.agentic_task_launch_menu_button}`}
        data-testid='agentic-task-agent-menu-button'
        disabled={!projectAvailable || launching}
        onClick={() => setAgentMenuOpen((open) => !open)}
        title={chooseAgentLabel}
        type='button'
      >
        <span aria-hidden='true' className='codicon codicon-chevron-down' />
      </button>
      {agentMenuOpen && (
        <div className={chatStyles.agentic_task_launch_menu} data-testid='agentic-task-agent-menu' role='menu'>
          {agentOptions.map((agent) => (
            <button
              className={`${chatStyles.agentic_task_launch_menu_item} ${
                agent.id === preferredAvailableAgentId ? chatStyles.agentic_task_launch_menu_item_selected : ''
              }`}
              aria-current={agent.id === preferredAvailableAgentId ? 'true' : undefined}
              data-testid={`agentic-task-agent-option-${agent.id}`}
              key={agent.id}
              disabled={launching}
              onClick={() => void launch(agent.id)}
              role='menuitem'
              title={agent.title}
              type='button'
            >
              <span className={chatStyles.agentic_task_launch_menu_item_label}>{agent.label}</span>
              {agent.id === preferredAvailableAgentId && (
                <span className={chatStyles.agentic_task_launch_menu_item_check}>
                  <span className={getIcon('check')} />
                </span>
              )}
            </button>
          ))}
          <div className={chatStyles.agentic_task_launch_menu_separator} />
          <button
            className={chatStyles.agentic_task_launch_menu_item}
            data-testid='agentic-task-agent-config-menu-item'
            onClick={() => void openAgentConfigurations()}
            role='menuitem'
            type='button'
          >
            {localize('aiNative.chat.agentSelector.configureAgents', 'Agent 配置')}
          </button>
        </div>
      )}
    </div>
  );
}
