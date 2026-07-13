import React from 'react';

import { PreferenceService, useInjectable } from '@opensumi/ide-core-browser';

import chatStyles from '../../chat/chat.module.less';
import { getAvailableAgentConfigs, getDefaultAgentType } from '../../chat/get-default-agent-type';
import { AgenticProjectRecord } from '../agentic-task-registry.service';
import { AgenticWorkspaceSwitchService } from '../agentic-workspace-switch.service';

import { getAgenticProjectDisplayLabel } from './agentic-project-label';
import styles from './agentic-task-list.module.less';

export interface AgenticTaskLaunchMenuProps {
  projects?: AgenticProjectRecord[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  preferredAgentId?: string;
  preferredProjectId?: string;
  variant?: 'task-list' | 'chat-header';
}

interface AgentOption {
  id: string;
  label: string;
  title: string;
}

function getAgentOptions(preferenceService: PreferenceService): AgentOption[] {
  return Object.entries(getAvailableAgentConfigs(preferenceService)).map(([id, config]) => ({
    id,
    label: config.description || id,
    title: config.command ? `${id} · ${config.command}` : id,
  }));
}

/**
 * A task is intentionally launched from an explicit Project selection. This
 * menu never changes the user's default ACP Agent preference.
 */
export function AgenticTaskLaunchMenu({
  projects = [],
  open,
  onOpenChange,
  preferredAgentId,
  preferredProjectId,
  variant = 'task-list',
}: AgenticTaskLaunchMenuProps) {
  const workspaceSwitch = useInjectable<AgenticWorkspaceSwitchService>(AgenticWorkspaceSwitchService);
  const preferenceService = useInjectable<PreferenceService>(PreferenceService);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<AgenticProjectRecord | undefined>();

  const isOpen = open ?? uncontrolledOpen;
  const isChatHeader = variant === 'chat-header';
  const availableProjects = React.useMemo(
    () => projects.filter((project) => project.availability === 'available'),
    [projects],
  );
  const agentOptions = React.useMemo(() => getAgentOptions(preferenceService), [preferenceService]);
  const preferredAvailableProjectId = availableProjects.some((project) => project.id === preferredProjectId)
    ? preferredProjectId
    : availableProjects[0]?.id;
  const preferredAvailableAgentId =
    [preferredAgentId, getDefaultAgentType(preferenceService)].find(
      (agentId): agentId is string => !!agentId && agentOptions.some((agent) => agent.id === agentId),
    ) ?? agentOptions[0]?.id;

  const setMenuOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (open === undefined) {
        setUncontrolledOpen(nextOpen);
      }
      if (!nextOpen) {
        setSelectedProject(undefined);
      }
      onOpenChange?.(nextOpen);
    },
    [onOpenChange, open],
  );

  const selectProject = React.useCallback((project: AgenticProjectRecord) => {
    if (project.availability === 'unavailable') {
      return;
    }
    setSelectedProject(project);
  }, []);

  const launch = React.useCallback(
    async (agentId: string) => {
      if (!selectedProject || selectedProject.availability === 'unavailable') {
        return;
      }
      await workspaceSwitch.launchTask(selectedProject, agentId);
      setMenuOpen(false);
    },
    [selectedProject, setMenuOpen, workspaceSwitch],
  );

  return (
    <div className={isChatHeader ? chatStyles.agentic_task_launch_menu_group : styles.launch_menu_group}>
      <button
        aria-expanded={isOpen}
        aria-haspopup='menu'
        aria-label='New Task'
        className={isChatHeader ? chatStyles.agentic_task_launch_button : styles.launch_button}
        data-testid='agentic-task-launch-button'
        disabled={availableProjects.length === 0}
        onClick={() => setMenuOpen(!isOpen)}
        title='New Task'
        type='button'
      >
        <span aria-hidden='true' className={isChatHeader ? 'codicon codicon-add' : undefined}>
          {isChatHeader ? undefined : '+'}
        </span>
        {!isChatHeader && <span className={styles.launch_button_label}>New Task</span>}
      </button>
      {isOpen && (
        <div className={styles.launch_menu} role='menu'>
          {!selectedProject ? (
            <>
              <div className={styles.launch_menu_label}>Choose Project</div>
              {availableProjects.map((project) => {
                const selected = project.id === preferredAvailableProjectId;
                return (
                  <button
                    aria-current={selected ? 'true' : undefined}
                    autoFocus={selected}
                    className={`${styles.launch_menu_item} ${selected ? styles.launch_menu_item_selected : ''}`}
                    key={project.id}
                    onClick={() => selectProject(project)}
                    role='menuitem'
                    title={project.workspacePath}
                    type='button'
                  >
                    <span className={styles.launch_menu_item_label}>{getAgenticProjectDisplayLabel(project)}</span>
                  </button>
                );
              })}
            </>
          ) : (
            <>
              <button
                className={styles.launch_menu_back}
                onClick={() => setSelectedProject(undefined)}
                role='menuitem'
                type='button'
              >
                ← {getAgenticProjectDisplayLabel(selectedProject)}
              </button>
              <div className={styles.launch_menu_label}>Choose ACP Agent</div>
              {agentOptions.map((agent) => {
                const selected = agent.id === preferredAvailableAgentId;
                return (
                  <button
                    aria-current={selected ? 'true' : undefined}
                    autoFocus={selected}
                    className={`${styles.launch_menu_item} ${selected ? styles.launch_menu_item_selected : ''}`}
                    key={agent.id}
                    onClick={() => void launch(agent.id)}
                    role='menuitem'
                    title={agent.title}
                    type='button'
                  >
                    <span className={styles.launch_menu_item_label}>{agent.label}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
