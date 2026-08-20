import cls from 'classnames';
import React from 'react';

import { COMMON_COMMANDS, PreferenceService, getIcon, localize, useInjectable } from '@opensumi/ide-core-browser';
import {
  ACPAgentType,
  AgentConfig,
  ChatMessageRole,
  CommandService,
  PreferenceScope,
  URI,
} from '@opensumi/ide-core-common';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings/ai-native';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IChatInternalService } from '../../common';
import { cleanAttachedTextWrapper } from '../../common/utils';
import { AgenticProjectRecord, AgenticTaskRegistryService } from '../acp/agentic-task-registry.service';
import { getAgenticProjectDisplayLabel } from '../acp/components/agentic-project-label';
import { AgenticTaskLaunchMenu } from '../acp/components/AgenticTaskLaunchMenu';
import { AIPanelLayoutService } from '../layout/panel-layout.service';

import { AgenticChatHeaderMaximizeAction } from './AgenticChatHeaderMaximizeAction';
import { ChatModel } from './chat-model';
import { AcpChatInternalService } from './chat.internal.service.acp';
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

function AgenticChatHeaderTaskLauncher({
  onExecutionContextChange,
  sessionModel,
}: {
  onExecutionContextChange: (project: AgenticProjectRecord | undefined) => void;
  sessionModel: ChatModel | undefined;
}) {
  const acpChatService = useInjectable<AcpChatInternalService>(IChatInternalService);
  const registry = useInjectable<AgenticTaskRegistryService>(AgenticTaskRegistryService);
  const workspaceService = useInjectable<IWorkspaceService>(IWorkspaceService);
  const [project, setProject] = React.useState<AgenticProjectRecord>();
  const [preferredAgentId, setPreferredAgentId] = React.useState<string>();
  const refreshVersionRef = React.useRef(0);

  const refreshProjects = React.useCallback(async () => {
    const refreshVersion = ++refreshVersionRef.current;
    const currentWorkspace = workspaceService.workspace;
    const latestRequest = sessionModel?.requests?.at(-1);
    const activeTarget = acpChatService.getActiveAgenticTaskTarget(sessionModel?.sessionId);
    try {
      const workspaceUri = currentWorkspace?.uri ? URI.parse(currentWorkspace.uri) : undefined;
      const currentProject =
        workspaceUri?.scheme === 'file' && currentWorkspace?.isDirectory !== false
          ? {
              id: workspaceUri.toString(),
              workspaceUri: workspaceUri.toString(),
              workspacePath: workspaceUri.codeUri.fsPath,
              joinedAt: 0,
              availability: 'available' as const,
            }
          : undefined;
      const projects = await registry.listProjects();
      const activeSessionProject = activeTarget
        ? projects.find((candidate) => candidate.workspacePath === activeTarget.cwd)
        : undefined;
      const persistedCurrentProject = currentProject ? await registry.getProject(currentProject.id) : undefined;
      if (refreshVersion !== refreshVersionRef.current) {
        return;
      }
      setProject(activeSessionProject || persistedCurrentProject || currentProject);
      onExecutionContextChange(
        activeSessionProject && activeSessionProject.workspacePath !== currentProject?.workspacePath
          ? activeSessionProject
          : undefined,
      );
      setPreferredAgentId(
        activeTarget?.agentId ||
          latestRequest?.message.agentId ||
          acpChatService.getActiveAgenticTaskAgentId(sessionModel?.sessionId),
      );
    } catch {
      if (refreshVersion === refreshVersionRef.current) {
        setProject(undefined);
        onExecutionContextChange(undefined);
        setPreferredAgentId(undefined);
      }
    }
  }, [acpChatService, onExecutionContextChange, registry, sessionModel, workspaceService]);

  React.useEffect(() => {
    void refreshProjects();
    const disposable = registry.onDidChange(() => void refreshProjects());
    const workspaceChangedDisposable = workspaceService.onWorkspaceChanged(() => void refreshProjects());
    const workspaceLocationChangedDisposable = workspaceService.onWorkspaceLocationChanged(
      () => void refreshProjects(),
    );
    return () => {
      refreshVersionRef.current += 1;
      disposable.dispose();
      workspaceChangedDisposable.dispose();
      workspaceLocationChangedDisposable.dispose();
    };
  }, [refreshProjects, registry, workspaceService]);

  return <AgenticTaskLaunchMenu project={project} preferredAgentId={preferredAgentId} variant='chat-header' />;
}

export function AgenticChatPanelHeader({
  onCloseTaskDraft,
  preferSessionTitle = false,
  sessionModel,
}: {
  onCloseTaskDraft?: () => void;
  preferSessionTitle?: boolean;
  sessionModel?: ChatModel;
}) {
  const acpChatService = useInjectable<AcpChatInternalService>(IChatInternalService);
  const preferenceService = useInjectable<PreferenceService>(PreferenceService);
  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);
  const registry = useInjectable<AgenticTaskRegistryService>(AgenticTaskRegistryService);
  const [panelLayout, setPanelLayout] = React.useState(() => panelLayoutService.getLayoutMode());
  const [title, setTitle] = React.useState(() => getAgenticChatPanelTitle(sessionModel, preferSessionTitle));
  const [executionContext, setExecutionContext] = React.useState<AgenticProjectRecord>();
  const titleRefreshVersionRef = React.useRef(0);
  const isTaskDraft = !sessionModel && !!acpChatService.getActiveAgenticTaskAgentId();
  const draftTarget = acpChatService.getActiveAgenticTaskTarget();
  const draftAgentId = draftTarget?.agentId;
  const draftAgentLabel = draftAgentId
    ? getAvailableAgentConfigs(preferenceService)[draftAgentId]?.description || draftAgentId
    : '';
  const draftProjectLabel = draftTarget ? URI.file(draftTarget.cwd).displayName : '';

  const refreshTitle = React.useCallback(async () => {
    const refreshVersion = ++titleRefreshVersionRef.current;
    if (refreshVersion !== titleRefreshVersionRef.current) {
      return;
    }
    setTitle(
      isTaskDraft
        ? localize('aiNative.chat.agenticTask.draft.title', 'New Session')
        : getAgenticChatPanelTitle(sessionModel, preferSessionTitle),
    );
  }, [isTaskDraft, preferSessionTitle, sessionModel]);

  React.useEffect(() => {
    setPanelLayout(panelLayoutService.getLayoutMode());
    const disposable = panelLayoutService.onDidChangePanelLayout((mode) => {
      setPanelLayout(mode);
    });

    return () => disposable.dispose();
  }, [panelLayoutService]);

  React.useEffect(() => {
    void refreshTitle();
    const messageDisposable = sessionModel?.history.onMessageChange(() => void refreshTitle());

    return () => {
      titleRefreshVersionRef.current += 1;
      messageDisposable?.dispose();
    };
  }, [refreshTitle, sessionModel]);

  if (panelLayout !== 'agentic') {
    return null;
  }

  return (
    <div className={styles.agentic_chat_panel_header} data-testid='agentic-chat-panel-header'>
      <div className={styles.agentic_chat_panel_title} data-testid='agentic-chat-panel-header-title' title={title}>
        {title}
      </div>
      {isTaskDraft && (
        <div className={styles.agentic_task_draft_context} data-testid='agentic-task-draft-context'>
          {localize(
            'aiNative.chat.agenticTask.draft.context',
            'Using {0}. Send your first message to create this Agent session.',
            draftAgentLabel,
          )}
          {draftProjectLabel && ` · ${draftProjectLabel}`}
        </div>
      )}
      {executionContext && (
        <div
          aria-label={localize(
            'aiNative.chat.agenticTask.workingDirectory',
            'Agent working directory: {0}',
            executionContext.workspacePath,
          )}
          className={styles.agentic_task_execution_context}
          data-testid='agentic-task-execution-context'
          title={executionContext.workspacePath}
        >
          {localize(
            'aiNative.chat.agenticTask.workingDirectory',
            'Agent working directory: {0}',
            getAgenticProjectDisplayLabel(executionContext),
          )}
        </div>
      )}
      <div className={styles.agentic_chat_panel_actions}>
        {isTaskDraft && onCloseTaskDraft && (
          <button
            aria-label={localize('aiNative.operate.close.title', 'Close')}
            className={styles.agentic_task_draft_close}
            data-testid='agentic-task-draft-close'
            onClick={onCloseTaskDraft}
            title={localize('aiNative.operate.close.title', 'Close')}
            type='button'
          >
            <span aria-hidden='true' className='codicon codicon-close' />
          </button>
        )}
        <AgenticChatHeaderTaskLauncher onExecutionContextChange={setExecutionContext} sessionModel={sessionModel} />
        <AgenticChatHeaderMaximizeAction id='agentic-chat-panel-header-maximize' />
      </div>
    </div>
  );
}

export function AgenticChatHeaderNewSessionMenu() {
  const aiChatService = useInjectable<AcpChatInternalService>(IChatInternalService);
  const preferenceService = useInjectable<PreferenceService>(PreferenceService);
  const commandService = useInjectable<CommandService>(CommandService);
  const [agentOptions, setAgentOptions] = React.useState<AgentSelectorOption[]>(() =>
    getAgentSelectorOptions(preferenceService),
  );
  const [agentType, setAgentType] = React.useState<ACPAgentType>(() => getDefaultAgentType(preferenceService));
  const [isCreatingSession, setIsCreatingSession] = React.useState(false);
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

  const openMenu = React.useCallback(() => {
    if (isCreatingSession) {
      return;
    }
    if (closeMenuTimerRef.current) {
      window.clearTimeout(closeMenuTimerRef.current);
      closeMenuTimerRef.current = undefined;
    }
    setIsMenuOpen(true);
  }, [isCreatingSession]);

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

  const handleCreateSessionWithAgent = React.useCallback(
    async (nextAgentType: ACPAgentType) => {
      setIsMenuOpen(false);
      setIsCreatingSession(true);
      try {
        setAgentType(nextAgentType);
        await preferenceService.set(AINativeSettingSectionsId.DefaultAgentType, nextAgentType, PreferenceScope.User);
        aiChatService.enterDraftSession();
      } finally {
        setIsCreatingSession(false);
      }
    },
    [aiChatService, preferenceService],
  );

  const handleOpenAgentConfigurations = React.useCallback(async () => {
    setIsMenuOpen(false);
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

  const selectedAgent = agentOptions.find((option) => option.value === agentType) || agentOptions[0];
  const tooltip = localize('aiNative.operate.newChat.title');

  return (
    <div className={styles.agentic_chat_new_session_menu_group}>
      <div className={styles.agentic_chat_new_session_menu_container} onMouseEnter={openMenu} onMouseLeave={closeMenu}>
        <button
          aria-disabled={isCreatingSession}
          aria-expanded={isMenuOpen}
          aria-haspopup='menu'
          aria-label={tooltip}
          className={styles.agentic_chat_new_session_button}
          data-testid='agentic-chat-new-session-button'
          disabled={isCreatingSession}
          onClick={openMenu}
          title={selectedAgent ? `${tooltip} · ${selectedAgent.title}` : tooltip}
          type='button'
        >
          <span className='codicon codicon-add' />
        </button>
        {isMenuOpen && (
          <div className={styles.agentic_chat_new_session_menu} data-testid='agentic-chat-new-session-menu' role='menu'>
            {agentOptions.map((option) => {
              const selected = option.value === agentType;
              return (
                <button
                  className={cls(
                    styles.agentic_chat_new_session_menu_item,
                    selected && styles.agentic_chat_new_session_menu_item_selected,
                  )}
                  data-testid={`agentic-chat-new-session-agent-${option.value}`}
                  key={option.value}
                  onClick={() => handleCreateSessionWithAgent(option.value)}
                  role='menuitem'
                  title={option.title}
                  type='button'
                >
                  <span className={styles.agentic_chat_new_session_menu_item_label}>{option.label}</span>
                  {selected && (
                    <span className={cls(styles.agentic_chat_new_session_menu_item_check, getIcon('check'))} />
                  )}
                </button>
              );
            })}
            <div className={styles.agentic_chat_new_session_menu_separator} />
            <button
              className={styles.agentic_chat_new_session_menu_item}
              data-testid='agentic-chat-agent-config-menu-item'
              onClick={handleOpenAgentConfigurations}
              role='menuitem'
              type='button'
            >
              {localize('aiNative.chat.agentSelector.configureAgents', 'Agent 配置')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
