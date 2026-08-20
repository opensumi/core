import React from 'react';

import { PreferenceService, localize, useInjectable } from '@opensumi/ide-core-browser';
import { IMessageService, IWindowDialogService } from '@opensumi/ide-overlay';

import { IChatInternalService } from '../../../common';
import { AcpChatInternalService } from '../../chat/chat.internal.service.acp';
import chatStyles from '../../chat/chat.module.less';
import { getAvailableAgentConfigs } from '../../chat/get-default-agent-type';
import { AcpAgentSessionDescriptor } from '../../chat/session-provider';
import { hasAcpChatSendPayload } from '../../components/acp/chat-input-validation';
import { AgenticProjectRecord, AgenticTaskRegistryService } from '../agentic-task-registry.service';
import { AgenticWorkspaceSwitchService } from '../agentic-workspace-switch.service';

import { getAgenticProjectDisplayLabel, getAgenticProjectDisplayLabels } from './agentic-project-label';
import styles from './agentic-task-list.module.less';
import { AgenticTaskLaunchMenu } from './AgenticTaskLaunchMenu';
import { ProjectRenameModal, TaskListResizeHandle } from './AgenticTaskList';

const DEFAULT_LIST_WIDTH = 244;
const MIN_LIST_WIDTH = 208;
const MAX_LIST_WIDTH = 280;
const MIN_CONVERSATION_WIDTH = 360;
const LIST_WIDTH_STORAGE_KEY = 'agentic.task-list-width.v1';

interface AgentSessionGroup {
  project: AgenticProjectRecord;
  sessions: AcpAgentSessionDescriptor[];
}

function clampListWidth(width: number, maximumWidth = MAX_LIST_WIDTH): number {
  return Math.max(MIN_LIST_WIDTH, Math.min(maximumWidth, width));
}

function getListMaximumWidth(chatSlotWidth: number): number {
  if (!Number.isFinite(chatSlotWidth) || chatSlotWidth <= 0) {
    return MAX_LIST_WIDTH;
  }
  return Math.max(MIN_LIST_WIDTH, Math.min(MAX_LIST_WIDTH, chatSlotWidth - MIN_CONVERSATION_WIDTH));
}

function getAgenticChatView(list: HTMLElement | null): HTMLElement | undefined {
  return list?.closest<HTMLElement>(`[id^="${chatStyles.ai_chat_view}"]`) || undefined;
}

function getStoredListWidth(): number | undefined {
  try {
    const width = Number.parseFloat(window.sessionStorage.getItem(LIST_WIDTH_STORAGE_KEY) || '');
    return Number.isFinite(width) ? width : undefined;
  } catch {
    return undefined;
  }
}

function storeListWidth(width: number): void {
  try {
    window.sessionStorage.setItem(LIST_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // Keep the in-memory width when tab storage is unavailable.
  }
}

function formatUpdatedAt(value: string | undefined): string {
  if (!value) {
    return '';
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : '';
}

function SessionRow({
  active,
  failed,
  pending,
  session,
  onActivate,
}: {
  active: boolean;
  failed: boolean;
  pending: boolean;
  session: AcpAgentSessionDescriptor;
  onActivate: (session: AcpAgentSessionDescriptor) => void;
}) {
  const title = session.title?.trim() || localize('aiNative.agentic.session.untitled', 'Untitled session');
  const updatedAt = formatUpdatedAt(session.updatedAt);
  const tooltip = [title, session.agentId, updatedAt].filter(Boolean).join('\n');

  return (
    <div className={`${styles.task_row_wrap} ${active ? styles.task_row_wrap_selected : ''}`}>
      <button
        aria-current={active ? 'true' : undefined}
        aria-label={title}
        className={`${styles.task_row} ${active ? styles.task_row_selected : ''}`}
        data-testid={`agentic-session-row-${session.sessionId}`}
        onClick={() => onActivate(session)}
        title={tooltip}
        type='button'
      >
        <span className={styles.task_title}>{title}</span>
        <span
          aria-label={
            pending
              ? localize('aiNative.agentic.session.loading', 'Loading session')
              : failed
              ? localize('aiNative.agentic.session.unavailable', 'Session unavailable')
              : session.agentId
          }
          className={`${styles.task_meta} ${
            failed ? styles.task_meta_error : pending ? styles.task_meta_information : styles.task_meta_secondary
          }`}
        >
          <span
            aria-hidden='true'
            className={`codicon ${
              failed ? 'codicon-error' : pending ? 'codicon-loading codicon-modifier-spin' : 'codicon-hubot'
            }`}
          />
        </span>
      </button>
    </div>
  );
}

function SessionProjectGroup({
  activeSessionId,
  collapsed,
  failedSessionIds,
  group,
  pendingSessionId,
  preferredAgentId,
  projectLabel,
  onActivate,
  onRemove,
  onRename,
  onToggle,
}: {
  activeSessionId?: string;
  collapsed: boolean;
  failedSessionIds: ReadonlySet<string>;
  group: AgentSessionGroup;
  pendingSessionId?: string;
  preferredAgentId?: string;
  projectLabel: string;
  onActivate: (session: AcpAgentSessionDescriptor) => void;
  onRemove: (project: AgenticProjectRecord) => void;
  onRename: (project: AgenticProjectRecord) => void;
  onToggle: () => void;
}) {
  const [managementOpen, setManagementOpen] = React.useState(false);
  const hasSessions = group.sessions.length > 0;

  return (
    <section className={styles.project_group} data-testid='agentic-session-project-group'>
      <header className={styles.project_header}>
        <button
          aria-expanded={!collapsed}
          className={styles.project_toggle}
          disabled={!hasSessions}
          onClick={onToggle}
          type='button'
        >
          <span
            aria-hidden='true'
            className={`${styles.project_chevron} codicon ${
              hasSessions ? (collapsed ? 'codicon-chevron-right' : 'codicon-chevron-down') : ''
            }`}
          />
          <span className={styles.project_label} title={group.project.workspacePath}>
            {projectLabel}
          </span>
          <span className={styles.project_count}>{group.sessions.length}</span>
        </button>
        <AgenticTaskLaunchMenu
          preferredAgentId={preferredAgentId}
          project={group.project}
          projectLabel={projectLabel}
        />
        <button
          aria-expanded={managementOpen}
          aria-label={localize('aiNative.agentic.project.manage', 'Manage project')}
          className={`${styles.project_manage} ${managementOpen ? styles.project_manage_open : ''}`}
          onClick={() => setManagementOpen((open) => !open)}
          type='button'
        >
          <span aria-hidden='true' className='codicon codicon-ellipsis' />
        </button>
        {managementOpen && (
          <div className={styles.project_management_menu}>
            <button
              className={styles.project_management_menu_item}
              onClick={() => {
                setManagementOpen(false);
                onRename(group.project);
              }}
              type='button'
            >
              {localize('aiNative.agentic.project.rename.action', 'Rename')}
            </button>
            <button
              className={styles.project_management_menu_item}
              disabled={hasSessions}
              onClick={() => {
                setManagementOpen(false);
                onRemove(group.project);
              }}
              title={
                hasSessions
                  ? localize(
                      'aiNative.agentic.project.removeHasSessions',
                      'Projects with Agent sessions cannot be removed.',
                    )
                  : undefined
              }
              type='button'
            >
              {localize('aiNative.agentic.project.removeAction', 'Remove Project')}
            </button>
          </div>
        )}
      </header>
      {!collapsed &&
        group.sessions.map((session) => (
          <SessionRow
            active={session.sessionId === activeSessionId}
            failed={failedSessionIds.has(session.sessionId)}
            key={session.sessionId}
            onActivate={onActivate}
            pending={session.sessionId === pendingSessionId}
            session={session}
          />
        ))}
    </section>
  );
}

export function AgenticSessionList() {
  const registry = useInjectable<AgenticTaskRegistryService>(AgenticTaskRegistryService);
  const workspaceSwitch = useInjectable<AgenticWorkspaceSwitchService>(AgenticWorkspaceSwitchService);
  const aiChatService = useInjectable<AcpChatInternalService>(IChatInternalService);
  const preferenceService = useInjectable<PreferenceService>(PreferenceService);
  const windowDialogService = useInjectable<IWindowDialogService>(IWindowDialogService);
  const messageService = useInjectable<IMessageService>(IMessageService);
  const listRef = React.useRef<HTMLElement>(null);
  const activationVersionRef = React.useRef(0);
  const projectRefreshVersionRef = React.useRef(0);
  const [projects, setProjects] = React.useState<AgenticProjectRecord[]>([]);
  const [sessions, setSessions] = React.useState<AcpAgentSessionDescriptor[]>(() => aiChatService.getAgentSessions());
  const [query, setQuery] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
  const [activeSessionId, setActiveSessionId] = React.useState<string | undefined>(
    aiChatService.sessionModel?.sessionId,
  );
  const [pendingSessionId, setPendingSessionId] = React.useState<string>();
  const [failedSessionIds, setFailedSessionIds] = React.useState<Set<string>>(() => new Set());
  const [collapsedProjectIds, setCollapsedProjectIds] = React.useState<Set<string>>(() => new Set());
  const [renameProject, setRenameProject] = React.useState<AgenticProjectRecord>();
  const [maximumListWidth, setMaximumListWidth] = React.useState(MAX_LIST_WIDTH);

  const refreshMaximumWidth = React.useCallback(() => {
    const maximum = getListMaximumWidth(getAgenticChatView(listRef.current)?.clientWidth || 0);
    setMaximumListWidth(maximum);
    return maximum;
  }, []);
  const getConfiguredWidth = React.useCallback((maximum: number) => {
    const chatView = getAgenticChatView(listRef.current);
    const configured = Number.parseFloat(chatView?.style.getPropertyValue('--agentic-task-list-width') || '');
    return clampListWidth(
      Number.isFinite(configured) ? configured : getStoredListWidth() || DEFAULT_LIST_WIDTH,
      maximum,
    );
  }, []);
  const resize = React.useCallback((width: number) => {
    getAgenticChatView(listRef.current)?.style.setProperty('--agentic-task-list-width', `${width}px`);
    storeListWidth(width);
  }, []);

  React.useEffect(() => {
    refreshMaximumWidth();
    const chatView = getAgenticChatView(listRef.current);
    if (!chatView || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(refreshMaximumWidth);
    observer.observe(chatView);
    return () => observer.disconnect();
  }, [refreshMaximumWidth]);

  const refreshProjects = React.useCallback(async () => {
    const refreshVersion = ++projectRefreshVersionRef.current;
    await workspaceSwitch.seedProjectCatalog();
    const current = await registry.listProjects();
    await Promise.all(current.map((project) => workspaceSwitch.refreshProjectAvailability(project)));
    const refreshed = await registry.listProjects();
    if (refreshVersion === projectRefreshVersionRef.current) {
      setProjects(refreshed);
    }
    return refreshed;
  }, [registry, workspaceSwitch]);

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshProjects();
      setSessions(await aiChatService.refreshAgentSessions());
    } catch {
      // Discovery failures are intentionally silent in Agentic Layout.
    } finally {
      setRefreshing(false);
    }
  }, [aiChatService, refreshProjects]);

  React.useEffect(() => {
    void refresh();
    const catalogDisposable = aiChatService.onDidChangeAgentSessions((catalog) => {
      setSessions(catalog.map((session) => ({ ...session })));
    });
    const projectDisposable = registry.onDidChange(() => void refreshProjects());
    const sessionDisposable = aiChatService.onChangeSession((sessionId) => setActiveSessionId(sessionId || undefined));
    return () => {
      projectRefreshVersionRef.current += 1;
      catalogDisposable.dispose();
      projectDisposable.dispose();
      sessionDisposable?.dispose();
    };
  }, [aiChatService, refresh, refreshProjects, registry]);

  const projectLabels = React.useMemo(() => getAgenticProjectDisplayLabels(projects), [projects]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const groups = React.useMemo<AgentSessionGroup[]>(() => {
    const sessionsByPath = new Map<string, AcpAgentSessionDescriptor[]>();
    for (const session of sessions) {
      if (normalizedQuery && !(session.title || '').toLocaleLowerCase().includes(normalizedQuery)) {
        continue;
      }
      const bucket = sessionsByPath.get(session.cwd) || [];
      bucket.push(session);
      sessionsByPath.set(session.cwd, bucket);
    }
    return projects
      .filter((project) => project.availability === 'available')
      .map((project) => ({
        project,
        sessions: (sessionsByPath.get(project.workspacePath) || []).sort(
          (a, b) => (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0),
        ),
      }))
      .filter((group) => !normalizedQuery || group.sessions.length > 0);
  }, [normalizedQuery, projects, sessions]);

  const activeTarget = aiChatService.getActiveAgenticTaskTarget(activeSessionId);
  const configuredAgents = getAvailableAgentConfigs(preferenceService);
  const preferredAgentId = activeTarget?.agentId || Object.keys(configuredAgents)[0];

  const activate = React.useCallback(
    async (session: AcpAgentSessionDescriptor) => {
      if (session.sessionId === activeSessionId && !failedSessionIds.has(session.sessionId)) {
        return;
      }
      const version = ++activationVersionRef.current;
      const hasUnsentDraft =
        aiChatService.isActiveAgenticTaskDraft() && hasAcpChatSendPayload(aiChatService.getInputDraft() || {});
      if (hasUnsentDraft) {
        const discardAndSwitch = localize('aiNative.agentic.session.discardDraftAndSwitch', 'Discard Draft and Switch');
        const selected = await messageService.warning(
          localize(
            'aiNative.agentic.session.switchDiscardDraft',
            'Discard the unsent draft and switch sessions? Your draft-bound Agent session will be closed.',
          ),
          [discardAndSwitch],
          true,
        );
        if (version !== activationVersionRef.current || selected !== discardAndSwitch) {
          return;
        }
      }
      setPendingSessionId(session.sessionId);
      const result = await aiChatService.activateAgentSession(session, () => version === activationVersionRef.current);
      if (version !== activationVersionRef.current) {
        return;
      }
      setPendingSessionId(undefined);
      if (result.status === 'activated') {
        if (hasUnsentDraft) {
          await aiChatService.discardAgenticTaskDraft();
        }
        setActiveSessionId(session.sessionId);
        setFailedSessionIds((current) => {
          const next = new Set(current);
          next.delete(session.sessionId);
          return next;
        });
      } else if (result.status !== 'superseded') {
        setFailedSessionIds((current) => new Set(current).add(session.sessionId));
      }
    },
    [activeSessionId, aiChatService, failedSessionIds, messageService],
  );

  const addProject = React.useCallback(async () => {
    const directories = await windowDialogService.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      title: localize('aiNative.agentic.project.add', 'Add Project'),
    });
    if (directories?.[0] && (await workspaceSwitch.addProject(directories[0]))) {
      await refresh();
    }
  }, [refresh, windowDialogService, workspaceSwitch]);

  const removeProject = React.useCallback(
    async (project: AgenticProjectRecord) => {
      if (await registry.removeManagedSessionProject(project.id)) {
        await refresh();
        return;
      }
      messageService.info(
        localize('aiNative.agentic.project.removeOnlyManaged', 'Only added Projects can be removed.'),
      );
    },
    [messageService, refresh, registry],
  );

  const rename = React.useCallback(
    async (project: AgenticProjectRecord, label: string) => {
      await registry.renameProject(project.id, label);
      await refreshProjects();
    },
    [refreshProjects, registry],
  );

  return (
    <aside
      aria-label={localize('aiNative.agentic.sessionList.title', 'Agent Sessions')}
      className={styles.task_list}
      data-testid='agentic-session-list'
      ref={listRef}
    >
      <TaskListResizeHandle
        ariaLabel={localize('aiNative.agentic.sessionList.resize', 'Resize Agent Sessions')}
        getConfiguredWidth={getConfiguredWidth}
        maximumWidth={maximumListWidth}
        onResize={resize}
        refreshMaximumWidth={refreshMaximumWidth}
      />
      <header className={styles.task_list_header}>
        <h2>{localize('aiNative.agentic.sessionList.title', 'Agent Sessions')}</h2>
        <button
          aria-label={localize('aiNative.agentic.sessionList.refresh', 'Refresh Agent sessions')}
          className={styles.project_add}
          data-testid='agentic-session-refresh-button'
          disabled={refreshing}
          onClick={() => void refresh()}
          title={localize('aiNative.agentic.sessionList.refresh', 'Refresh Agent sessions')}
          type='button'
        >
          <span aria-hidden='true' className={`codicon codicon-refresh ${refreshing ? 'codicon-modifier-spin' : ''}`} />
        </button>
        <button
          aria-label={localize('aiNative.agentic.project.add', 'Add Project')}
          className={styles.project_add}
          data-testid='agentic-project-add-button'
          onClick={() => void addProject()}
          title={localize('aiNative.agentic.project.add', 'Add Project')}
          type='button'
        >
          <span aria-hidden='true' className='codicon codicon-new-folder' />
        </button>
      </header>
      <label className={styles.search}>
        <span aria-hidden='true' className='codicon codicon-search' />
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder={localize('aiNative.agentic.sessionList.search', 'Search sessions')}
          type='search'
          value={query}
        />
      </label>
      <div className={styles.task_groups}>
        {groups.map((group) => (
          <SessionProjectGroup
            activeSessionId={activeSessionId}
            collapsed={collapsedProjectIds.has(group.project.id) && !normalizedQuery}
            failedSessionIds={failedSessionIds}
            group={group}
            key={group.project.id}
            onActivate={activate}
            onRemove={(project) => void removeProject(project)}
            onRename={setRenameProject}
            onToggle={() =>
              setCollapsedProjectIds((current) => {
                const next = new Set(current);
                if (next.has(group.project.id)) {
                  next.delete(group.project.id);
                } else {
                  next.add(group.project.id);
                }
                return next;
              })
            }
            pendingSessionId={pendingSessionId}
            preferredAgentId={preferredAgentId}
            projectLabel={projectLabels.get(group.project.id) || getAgenticProjectDisplayLabel(group.project)}
          />
        ))}
      </div>
      <ProjectRenameModal
        onClose={() => setRenameProject(undefined)}
        onRename={rename}
        project={renameProject}
        projectLabel={
          renameProject && (projectLabels.get(renameProject.id) || getAgenticProjectDisplayLabel(renameProject))
        }
      />
    </aside>
  );
}
