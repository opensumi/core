import React from 'react';

import { PreferenceService, localize, useInjectable } from '@opensumi/ide-core-browser';
import { IMessageService, IWindowDialogService } from '@opensumi/ide-overlay';
import { strings } from '@opensumi/ide-utils';

import { IChatInternalService } from '../../../common';
import { AcpChatInternalService } from '../../chat/chat.internal.service.acp';
import chatStyles from '../../chat/chat.module.less';
import { getDefaultAgentType } from '../../chat/get-default-agent-type';
import { AcpAgentSessionDescriptor } from '../../chat/session-provider';
import { hasAcpChatSendPayload } from '../../components/acp/chat-input-validation';
import {
  AgenticArchivedSessionIdentity,
  AgenticArchivedSessionRecord,
  AgenticProjectRecord,
  AgenticTaskRegistryService,
} from '../agentic-task-registry.service';
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

function getArchivedSessionIdentity(session: AcpAgentSessionDescriptor): AgenticArchivedSessionIdentity {
  return { sessionId: session.sessionId, agentId: session.agentId, cwd: session.cwd };
}

function getArchivedSessionKey(session: AgenticArchivedSessionIdentity): string {
  return JSON.stringify([session.agentId, session.cwd, session.sessionId]);
}

function SessionRow({
  active,
  archived,
  failed,
  pending,
  session,
  onActivate,
  onArchive,
  onUnarchive,
}: {
  active: boolean;
  archived: boolean;
  failed: boolean;
  pending: boolean;
  session: AcpAgentSessionDescriptor;
  onActivate: (session: AcpAgentSessionDescriptor) => void;
  onArchive?: (session: AcpAgentSessionDescriptor) => void;
  onUnarchive?: (session: AcpAgentSessionDescriptor) => void;
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
        {(pending || failed) && (
          <span
            aria-label={
              pending
                ? localize('aiNative.agentic.session.loading', 'Loading session')
                : localize('aiNative.agentic.session.unavailable', 'Session unavailable')
            }
            className={`${styles.task_meta} ${failed ? styles.task_meta_error : styles.task_meta_information}`}
          >
            <span
              aria-hidden='true'
              className={`codicon ${failed ? 'codicon-error' : 'codicon-loading codicon-modifier-spin'}`}
            />
          </span>
        )}
      </button>
      {archived ? (
        <button
          aria-label={localize('aiNative.agentic.session.unarchive', 'Unarchive session')}
          className={styles.archive_button}
          data-testid={`agentic-session-unarchive-${session.sessionId}`}
          onClick={() => onUnarchive?.(session)}
          title={localize('aiNative.agentic.session.unarchive', 'Unarchive session')}
          type='button'
        >
          <span aria-hidden='true' className='codicon codicon-archive' />
        </button>
      ) : (
        <button
          aria-label={localize('aiNative.agentic.session.archive', 'Archive session')}
          className={styles.archive_button}
          data-testid={`agentic-session-archive-${session.sessionId}`}
          onClick={() => onArchive?.(session)}
          title={localize('aiNative.agentic.session.archive', 'Archive session')}
          type='button'
        >
          <span aria-hidden='true' className='codicon codicon-archive' />
        </button>
      )}
    </div>
  );
}

function SessionProjectGroup({
  activeSessionId,
  collapsed,
  failedSessionIds,
  group,
  hasAgentSessions,
  pendingSessionId,
  preferredAgentId,
  projectLabel,
  onActivate,
  onArchive,
  onRemove,
  onRename,
  onToggle,
}: {
  activeSessionId?: string;
  collapsed: boolean;
  failedSessionIds: ReadonlySet<string>;
  group: AgentSessionGroup;
  hasAgentSessions: boolean;
  pendingSessionId?: string;
  preferredAgentId?: string;
  projectLabel: string;
  onActivate: (session: AcpAgentSessionDescriptor) => void;
  onArchive: (session: AcpAgentSessionDescriptor) => void;
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
          aria-label={strings.format(localize('aiNative.agentic.project.manage', 'Manage {0}'), projectLabel)}
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
              disabled={hasAgentSessions}
              onClick={() => {
                setManagementOpen(false);
                onRemove(group.project);
              }}
              title={
                hasAgentSessions
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
            archived={false}
            failed={failedSessionIds.has(session.sessionId)}
            key={session.sessionId}
            onActivate={onActivate}
            onArchive={onArchive}
            pending={session.sessionId === pendingSessionId}
            session={session}
          />
        ))}
    </section>
  );
}

function ArchivedSessionGroups({
  groups,
  onActivate,
  onUnarchive,
  projectLabels,
}: {
  groups: AgentSessionGroup[];
  onActivate: (session: AcpAgentSessionDescriptor) => void;
  onUnarchive: (session: AcpAgentSessionDescriptor) => void;
  projectLabels: ReadonlyMap<string, string>;
}) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <section
      className={`${styles.archived_area} ${expanded ? styles.archived_area_expanded : ''}`}
      data-expanded={expanded}
      data-testid='agentic-archived-session-area'
    >
      <button
        aria-expanded={expanded}
        className={styles.archived_toggle}
        onClick={() => setExpanded((current) => !current)}
        type='button'
      >
        <span aria-hidden='true' className={`codicon ${expanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`} />
        <span>{localize('aiNative.agentic.sessionList.archived', 'Archived Sessions')}</span>
      </button>
      {expanded &&
        groups.map((group) => (
          <section className={styles.archived_project_group} key={group.project.id}>
            <div className={styles.project_header}>
              <span className={styles.project_label} title={group.project.workspacePath}>
                {projectLabels.get(group.project.id) || getAgenticProjectDisplayLabel(group.project)}
              </span>
              <span className={styles.project_count}>{group.sessions.length}</span>
            </div>
            {group.sessions.map((session) => (
              <SessionRow
                active={false}
                archived
                failed={false}
                key={session.sessionId}
                onActivate={onActivate}
                onUnarchive={onUnarchive}
                pending={false}
                session={session}
              />
            ))}
          </section>
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
  const [archivedSessions, setArchivedSessions] = React.useState<AgenticArchivedSessionRecord[]>([]);
  const [query, setQuery] = React.useState('');
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

  const refreshArchivedSessions = React.useCallback(async () => {
    const archived = await registry.listArchivedAgentSessions();
    setArchivedSessions(archived);
    return archived;
  }, [registry]);

  const refresh = React.useCallback(async () => {
    try {
      await Promise.all([refreshProjects(), refreshArchivedSessions()]);
      setSessions(await aiChatService.refreshAgentSessions());
    } catch {
      // Discovery failures are intentionally silent in Agentic Layout.
    }
  }, [aiChatService, refreshArchivedSessions, refreshProjects]);

  React.useEffect(() => {
    void refresh();
    const catalogDisposable = aiChatService.onDidChangeAgentSessions((catalog) => {
      setSessions(catalog.map((session) => ({ ...session })));
    });
    const projectDisposable = registry.onDidChange(() => void refresh());
    const sessionDisposable = aiChatService.onChangeSession((sessionId) => setActiveSessionId(sessionId || undefined));
    return () => {
      projectRefreshVersionRef.current += 1;
      catalogDisposable.dispose();
      projectDisposable.dispose();
      sessionDisposable?.dispose();
    };
  }, [aiChatService, refresh, registry]);

  const projectLabels = React.useMemo(() => getAgenticProjectDisplayLabels(projects), [projects]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const archivedSessionKeys = React.useMemo(
    () => new Set(archivedSessions.map(getArchivedSessionKey)),
    [archivedSessions],
  );
  const createGroups = React.useCallback(
    (archived: boolean): AgentSessionGroup[] => {
      const sessionsByPath = new Map<string, AcpAgentSessionDescriptor[]>();
      for (const session of sessions) {
        if (archivedSessionKeys.has(getArchivedSessionKey(session)) !== archived) {
          continue;
        }
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
        .filter((group) => (archived ? group.sessions.length > 0 : !normalizedQuery || group.sessions.length > 0));
    },
    [archivedSessionKeys, normalizedQuery, projects, sessions],
  );
  const groups = React.useMemo(() => createGroups(false), [createGroups]);
  const archivedGroups = React.useMemo(() => createGroups(true), [createGroups]);

  const activeTarget = aiChatService.getActiveAgenticTaskTarget(activeSessionId);
  const preferredAgentId = activeTarget?.agentId || getDefaultAgentType(preferenceService);

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

  const archive = React.useCallback(
    async (session: AcpAgentSessionDescriptor) => {
      if (await registry.archiveAgentSession(getArchivedSessionIdentity(session))) {
        await refreshArchivedSessions();
      }
    },
    [refreshArchivedSessions, registry],
  );

  const unarchive = React.useCallback(
    async (session: AcpAgentSessionDescriptor) => {
      if (await registry.unarchiveAgentSession(getArchivedSessionIdentity(session))) {
        await refreshArchivedSessions();
      }
    },
    [refreshArchivedSessions, registry],
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
            hasAgentSessions={sessions.some((session) => session.cwd === group.project.workspacePath)}
            key={group.project.id}
            onActivate={activate}
            onArchive={(session) => void archive(session)}
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
      <ArchivedSessionGroups
        groups={archivedGroups}
        onActivate={activate}
        onUnarchive={(session) => void unarchive(session)}
        projectLabels={projectLabels}
      />
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
