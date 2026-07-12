import React from 'react';

import { PreferenceService, useInjectable } from '@opensumi/ide-core-browser';

import { AgenticProjectRecord } from '../agentic-task-registry.service';
import { AgenticWorkspaceSwitchService } from '../agentic-workspace-switch.service';
import { getAvailableAgentConfigs } from '../../chat/get-default-agent-type';

import styles from './agentic-task-list.module.less';

export interface AgenticTaskLaunchMenuProps {
  projects?: AgenticProjectRecord[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
export function AgenticTaskLaunchMenu({ projects = [], open, onOpenChange }: AgenticTaskLaunchMenuProps) {
  const workspaceSwitch = useInjectable<AgenticWorkspaceSwitchService>(AgenticWorkspaceSwitchService);
  const preferenceService = useInjectable<PreferenceService>(PreferenceService);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<AgenticProjectRecord | undefined>();

  const isOpen = open ?? uncontrolledOpen;
  const agentOptions = React.useMemo(() => getAgentOptions(preferenceService), [preferenceService]);
  const availableProjects = React.useMemo(
    () => [...projects].sort((left, right) => right.joinedAt - left.joinedAt),
    [projects],
  );

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
    <div className={styles.launch_menu_group}>
      <button
        aria-expanded={isOpen}
        aria-haspopup='menu'
        className={styles.launch_button}
        data-testid='agentic-task-launch-button'
        disabled={availableProjects.length === 0}
        onClick={() => setMenuOpen(!isOpen)}
        title='New Task'
        type='button'
      >
        <span aria-hidden='true'>+</span>
        <span className={styles.launch_button_label}>New Task</span>
      </button>
      {isOpen && (
        <div className={styles.launch_menu} role='menu'>
          {!selectedProject ? (
            <>
              <div className={styles.launch_menu_label}>Choose Project</div>
              {availableProjects.map((project) => (
                <button
                  className={styles.launch_menu_item}
                  disabled={project.availability === 'unavailable'}
                  key={project.id}
                  onClick={() => selectProject(project)}
                  role='menuitem'
                  title={project.workspacePath}
                  type='button'
                >
                  <span className={styles.launch_menu_item_label}>{project.label}</span>
                  {project.availability === 'unavailable' && (
                    <span className={styles.unavailable_label}>Unavailable</span>
                  )}
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                className={styles.launch_menu_back}
                onClick={() => setSelectedProject(undefined)}
                role='menuitem'
                type='button'
              >
                ← {selectedProject.label}
              </button>
              <div className={styles.launch_menu_label}>Choose ACP Agent</div>
              {agentOptions.map((agent) => (
                <button
                  className={styles.launch_menu_item}
                  key={agent.id}
                  onClick={() => void launch(agent.id)}
                  role='menuitem'
                  title={agent.title}
                  type='button'
                >
                  <span className={styles.launch_menu_item_label}>{agent.label}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
