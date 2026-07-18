import React from 'react';

import { Modal } from '@opensumi/ide-components/lib/modal';
import { useInjectable } from '@opensumi/ide-core-browser';
import { IWindowDialogService } from '@opensumi/ide-overlay';

import { IChatInternalService } from '../../../common';
import { AcpChatInternalService } from '../../chat/chat.internal.service.acp';
import chatStyles from '../../chat/chat.module.less';
import {
  AgenticProjectRecord,
  AgenticTaskGroup,
  AgenticTaskRecord,
  AgenticTaskRegistryService,
  AgenticTaskStatus,
} from '../agentic-task-registry.service';
import { AgenticWorkspaceSwitchService } from '../agentic-workspace-switch.service';

import { getAgenticProjectDisplayLabel, getAgenticProjectDisplayLabels } from './agentic-project-label';
import styles from './agentic-task-list.module.less';
import { AgenticTaskLaunchMenu } from './AgenticTaskLaunchMenu';

const DEFAULT_TASK_LIST_WIDTH = 244;
const MIN_TASK_LIST_WIDTH = 208;
const MAX_TASK_LIST_WIDTH = 280;
const MIN_CONVERSATION_WIDTH = 360;
const TASK_LIST_WIDTH_STORAGE_KEY = 'agentic.task-list-width.v1';
const ARCHIVABLE_STATUSES = new Set<AgenticTaskStatus>(['ready', 'stopped', 'error']);

function clampTaskListWidth(width: number, maximumWidth = MAX_TASK_LIST_WIDTH): number {
  return Math.max(MIN_TASK_LIST_WIDTH, Math.min(maximumWidth, width));
}

function getTaskListMaximumWidth(chatSlotWidth: number): number {
  if (!Number.isFinite(chatSlotWidth) || chatSlotWidth <= 0) {
    return MAX_TASK_LIST_WIDTH;
  }
  return Math.max(MIN_TASK_LIST_WIDTH, Math.min(MAX_TASK_LIST_WIDTH, chatSlotWidth - MIN_CONVERSATION_WIDTH));
}

function filterGroups(groups: AgenticTaskGroup[], query: string): AgenticTaskGroup[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return groups
    .filter((group) => group.project.availability === 'available')
    .map((group) => ({
      project: group.project,
      tasks: group.tasks.filter((task) => !normalizedQuery || task.title.toLocaleLowerCase().includes(normalizedQuery)),
    }))
    .filter((group) => group.tasks.length > 0 || (!normalizedQuery && group.project.managed));
}

function getAgenticChatView(taskList: HTMLElement | null): HTMLElement | undefined {
  return taskList?.closest<HTMLElement>(`[id^="${chatStyles.ai_chat_view}"]`) || undefined;
}

function getConfiguredTaskListWidth(chatView: HTMLElement | undefined, maximumWidth: number): number {
  const configuredWidth = Number.parseFloat(chatView?.style.getPropertyValue('--agentic-task-list-width') || '');
  return Number.isFinite(configuredWidth)
    ? clampTaskListWidth(configuredWidth, maximumWidth)
    : clampTaskListWidth(DEFAULT_TASK_LIST_WIDTH, maximumWidth);
}

function getStoredTaskListWidth(): number | undefined {
  try {
    const storedWidth = Number.parseFloat(window.sessionStorage.getItem(TASK_LIST_WIDTH_STORAGE_KEY) || '');
    return Number.isFinite(storedWidth) ? storedWidth : undefined;
  } catch {
    return undefined;
  }
}

function storeTaskListWidth(width: number): void {
  try {
    window.sessionStorage.setItem(TASK_LIST_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // Ignore unavailable tab storage and keep the in-memory preference.
  }
}

function TaskListResizeHandle({
  getConfiguredWidth,
  maximumWidth,
  onResize,
  refreshMaximumWidth,
}: {
  getConfiguredWidth: (maximumWidth: number) => number;
  maximumWidth: number;
  onResize: (width: number) => void;
  refreshMaximumWidth: () => number;
}) {
  const [width, setWidth] = React.useState(DEFAULT_TASK_LIST_WIDTH);
  const resizeStart = React.useRef<{ clientX: number; maximumWidth: number; width: number }>();

  const resize = React.useCallback(
    (nextWidth: number, limit = maximumWidth) => {
      const clampedWidth = clampTaskListWidth(nextWidth, limit);
      setWidth(clampedWidth);
      onResize(clampedWidth);
    },
    [maximumWidth, onResize],
  );

  React.useEffect(() => {
    setWidth(getConfiguredWidth(maximumWidth));
  }, [getConfiguredWidth, maximumWidth]);

  React.useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!resizeStart.current) {
        return;
      }
      resize(resizeStart.current.width + event.clientX - resizeStart.current.clientX, resizeStart.current.maximumWidth);
    };
    const onMouseMove = (event: MouseEvent) => {
      if (!resizeStart.current) {
        return;
      }
      resize(resizeStart.current.width + event.clientX - resizeStart.current.clientX, resizeStart.current.maximumWidth);
    };
    const finishResize = () => {
      resizeStart.current = undefined;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finishResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', finishResize);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', finishResize);
    };
  }, [resize]);

  const beginResize = React.useCallback(
    (clientX: number) => {
      if (resizeStart.current) {
        return;
      }
      const currentMaximumWidth = refreshMaximumWidth();
      resizeStart.current = {
        clientX,
        maximumWidth: currentMaximumWidth,
        width: getConfiguredWidth(currentMaximumWidth),
      };
    },
    [getConfiguredWidth, refreshMaximumWidth],
  );

  return (
    <div
      aria-label='Resize Agent Tasks'
      aria-orientation='vertical'
      aria-valuemax={maximumWidth}
      aria-valuemin={MIN_TASK_LIST_WIDTH}
      aria-valuenow={width}
      className={styles.resize_handle}
      data-testid='agentic-task-list-resize-handle'
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          resize(width - 8, refreshMaximumWidth());
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          resize(width + 8, refreshMaximumWidth());
        }
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        beginResize(event.clientX);
      }}
      onMouseDown={(event) => {
        event.preventDefault();
        beginResize(event.clientX);
      }}
      role='separator'
      tabIndex={0}
    />
  );
}

type TaskRowMetaKind = AgenticTaskStatus | 'permission' | 'input';

interface TaskRowPresentation {
  icon: string;
  kind: TaskRowMetaKind;
  label: string;
  testIdPrefix: 'agentic-task-attention' | 'agentic-task-status';
  tone: 'error' | 'information' | 'secondary' | 'warning';
}

const TASK_ROW_PRESENTATIONS: Readonly<Record<TaskRowMetaKind, TaskRowPresentation | undefined>> = {
  running: {
    icon: 'codicon-loading codicon-modifier-spin',
    kind: 'running',
    label: 'Running',
    testIdPrefix: 'agentic-task-status',
    tone: 'information',
  },
  stopped: {
    icon: 'codicon-circle-slash',
    kind: 'stopped',
    label: 'Stopped',
    testIdPrefix: 'agentic-task-status',
    tone: 'secondary',
  },
  error: {
    icon: 'codicon-error',
    kind: 'error',
    label: 'Error',
    testIdPrefix: 'agentic-task-status',
    tone: 'error',
  },
  ready: undefined,
  permission: {
    icon: 'codicon-warning',
    kind: 'permission',
    label: 'Permission',
    testIdPrefix: 'agentic-task-attention',
    tone: 'warning',
  },
  input: {
    icon: 'codicon-warning',
    kind: 'input',
    label: 'Input needed',
    testIdPrefix: 'agentic-task-attention',
    tone: 'warning',
  },
};

function getTaskRowPresentation(task: AgenticTaskRecord): TaskRowPresentation | undefined {
  const kind = task.attention || task.status;
  return kind ? TASK_ROW_PRESENTATIONS[kind] : undefined;
}

function ProjectRenameModal({
  onClose,
  onRename,
  project,
  projectLabel,
}: {
  onClose: () => void;
  onRename: (project: AgenticProjectRecord, label: string) => Promise<void>;
  project: AgenticProjectRecord | undefined;
  projectLabel: string | undefined;
}) {
  const [label, setLabel] = React.useState('');

  React.useEffect(() => {
    setLabel(project?.label || '');
  }, [project]);

  const save = React.useCallback(async () => {
    if (!project) {
      return;
    }
    await onRename(project, label);
    onClose();
  }, [label, onClose, onRename, project]);

  return (
    <Modal
      cancelText='Cancel'
      centered
      okText='Save'
      onCancel={onClose}
      onOk={() => void save()}
      title={`Rename ${projectLabel || 'Project'}`}
      visible={!!project}
      width={360}
    >
      <label className={styles.project_rename_form}>
        <span>Project name</span>
        <input
          aria-label='Project name'
          autoFocus
          onChange={(event) => setLabel(event.target.value)}
          placeholder={projectLabel}
          type='text'
          value={label}
        />
        {project && <span className={styles.project_rename_path}>Workspace: {project.workspacePath}</span>}
        <span className={styles.project_rename_hint}>Clear the name to use the default project name.</span>
      </label>
    </Modal>
  );
}

function TaskRow({
  active,
  onArchive,
  onActivate,
  onUnarchive,
  projectAvailable,
  task,
}: {
  active: boolean;
  onArchive: (task: AgenticTaskRecord) => void;
  onActivate: (task: AgenticTaskRecord) => void;
  onUnarchive?: (task: AgenticTaskRecord) => void;
  projectAvailable: boolean;
  task: AgenticTaskRecord;
}) {
  const archiveEligible = !!task.status && ARCHIVABLE_STATUSES.has(task.status) && !task.archived;
  const actionAvailable = archiveEligible || (task.archived && !!onUnarchive);
  const presentation = getTaskRowPresentation(task);

  return (
    <div className={`${styles.task_row_wrap} ${actionAvailable ? styles.task_row_wrap_actionable : ''}`}>
      <button
        aria-current={active ? 'true' : undefined}
        className={`${styles.task_row} ${active ? styles.task_row_selected : ''}`}
        data-testid={`agentic-task-row-${task.sessionId}`}
        disabled={!projectAvailable}
        onClick={() => onActivate(task)}
        title={projectAvailable ? task.title : `${task.title} (Project unavailable)`}
        type='button'
      >
        <span className={styles.task_title}>{task.title}</span>
        {presentation && (
          <span
            className={`${styles.task_meta} ${styles[`task_meta_${presentation.tone}`]}`}
            data-agentic-task-meta-kind={presentation.kind}
            data-testid={`${presentation.testIdPrefix}-${task.sessionId}`}
            title={presentation.label}
          >
            <span aria-hidden='true' className={`codicon ${presentation.icon}`} />
            <span>{presentation.label}</span>
          </span>
        )}
        {task.unread && (
          <span aria-label='Unread' className={styles.unread} data-testid={`agentic-task-unread-${task.sessionId}`} />
        )}
      </button>
      {archiveEligible && (
        <button
          aria-label={`Archive ${task.title}`}
          className={styles.archive_button}
          data-testid={`agentic-task-archive-${task.sessionId}`}
          onClick={() => onArchive(task)}
          title={`Archive ${task.title}`}
          type='button'
        >
          <span aria-hidden='true' className='codicon codicon-archive' />
        </button>
      )}
      {task.archived && onUnarchive && (
        <button
          aria-label={`Unarchive ${task.title}`}
          className={styles.archive_button}
          data-testid={`agentic-task-unarchive-${task.sessionId}`}
          onClick={() => onUnarchive(task)}
          title={`Unarchive ${task.title}`}
          type='button'
        >
          <span aria-hidden='true' className='codicon codicon-archive' />
        </button>
      )}
    </div>
  );
}

function ProjectGroup({
  activeSessionId,
  collapseDisabled,
  expanded,
  group,
  onArchive,
  onRemove,
  onRename,
  onTaskActivate,
  onToggleExpanded,
  preferredAgentId,
  projectLabel,
}: {
  activeSessionId: string | undefined;
  collapseDisabled: boolean;
  expanded: boolean;
  group: AgenticTaskGroup;
  onArchive: (task: AgenticTaskRecord) => void;
  onRemove: (project: AgenticProjectRecord) => void;
  onRename: (project: AgenticProjectRecord) => void;
  onTaskActivate: (task: AgenticTaskRecord) => void;
  onToggleExpanded: () => void;
  preferredAgentId?: string;
  projectLabel: string;
}) {
  const projectAvailable = group.project.availability === 'available';
  const hasTasks = group.tasks.length > 0;
  const [managementMenuOpen, setManagementMenuOpen] = React.useState(false);

  return (
    <section className={styles.project_group} data-testid='agentic-task-project-group'>
      <header className={styles.project_header}>
        {hasTasks ? (
          <button
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${projectLabel}`}
            className={styles.project_toggle}
            data-testid={`agentic-task-project-toggle-${group.project.id}`}
            disabled={collapseDisabled}
            onClick={onToggleExpanded}
            type='button'
          >
            <span
              aria-hidden='true'
              className={`${styles.project_chevron} codicon ${
                expanded ? 'codicon-chevron-down' : 'codicon-chevron-right'
              }`}
            />
            <span className={styles.project_label} title={group.project.workspacePath}>
              {projectLabel}
            </span>
            <span className={styles.project_count}>{group.tasks.length}</span>
          </button>
        ) : (
          <div className={styles.project_toggle_placeholder}>
            <span aria-hidden='true' className={styles.project_chevron} />
            <span className={styles.project_label} title={group.project.workspacePath}>
              {projectLabel}
            </span>
            <span className={styles.project_count}>{group.tasks.length}</span>
          </div>
        )}
        <AgenticTaskLaunchMenu
          preferredAgentId={preferredAgentId}
          project={group.project}
          projectLabel={projectLabel}
        />
        <button
          aria-expanded={managementMenuOpen}
          aria-label={`Manage ${projectLabel}`}
          className={`${styles.project_manage} ${managementMenuOpen ? styles.project_manage_open : ''}`}
          onClick={() => setManagementMenuOpen((open) => !open)}
          title={`Manage ${projectLabel}`}
          type='button'
        >
          <span aria-hidden='true' className='codicon codicon-ellipsis' />
        </button>
        {managementMenuOpen && (
          <div className={styles.project_management_menu}>
            <button
              aria-label={`Rename ${projectLabel}`}
              className={styles.project_management_menu_item}
              onClick={() => {
                setManagementMenuOpen(false);
                onRename(group.project);
              }}
              type='button'
            >
              Rename
            </button>
            {group.project.managed && group.tasks.length === 0 && (
              <button
                aria-label={`Remove ${projectLabel}`}
                className={styles.project_management_menu_item}
                onClick={() => {
                  setManagementMenuOpen(false);
                  onRemove(group.project);
                }}
                type='button'
              >
                Remove Project
              </button>
            )}
          </div>
        )}
      </header>
      {expanded &&
        group.tasks.map((task) => (
          <TaskRow
            active={task.sessionId === activeSessionId}
            key={task.sessionId}
            onActivate={onTaskActivate}
            onArchive={onArchive}
            projectAvailable={projectAvailable}
            task={task}
          />
        ))}
    </section>
  );
}

function ArchivedTaskGroups({
  projectRevision,
  projectLabels,
  query,
  refreshProjectCatalog,
  registry,
  onUnarchive,
  workspaceSwitch,
}: {
  projectRevision: number;
  projectLabels: ReadonlyMap<string, string>;
  query: string;
  refreshProjectCatalog: () => Promise<AgenticProjectRecord[]>;
  registry: AgenticTaskRegistryService;
  onUnarchive: (task: AgenticTaskRecord) => Promise<boolean>;
  workspaceSwitch: AgenticWorkspaceSwitchService;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [groups, setGroups] = React.useState<AgenticTaskGroup[]>([]);

  React.useEffect(() => {
    if (!expanded) {
      return;
    }
    let disposed = false;
    void (async () => {
      await refreshProjectCatalog();
      const archivedGroups = await registry.listArchivedGroups(query);
      if (!disposed) {
        setGroups(filterGroups(archivedGroups, query));
      }
    })();
    return () => {
      disposed = true;
    };
  }, [expanded, projectRevision, query, refreshProjectCatalog, registry]);

  const unarchive = React.useCallback(
    async (task: AgenticTaskRecord) => {
      if (!(await onUnarchive(task))) {
        return;
      }
      setGroups((currentGroups) =>
        currentGroups
          .map((group) => ({
            ...group,
            tasks: group.tasks.filter((candidate) => candidate.sessionId !== task.sessionId),
          }))
          .filter((group) => group.tasks.length > 0),
      );
    },
    [onUnarchive],
  );

  return (
    <section
      className={`${styles.archived_area} ${expanded ? styles.archived_area_expanded : ''}`}
      data-expanded={expanded}
      data-testid='agentic-archived-task-area'
    >
      <button
        aria-expanded={expanded}
        className={styles.archived_toggle}
        onClick={() => setExpanded(!expanded)}
        type='button'
      >
        <span aria-hidden='true' className={`codicon ${expanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`} />
        <span>Archived Tasks</span>
      </button>
      {expanded &&
        groups.map((group) => (
          <section className={styles.archived_project_group} key={group.project.id}>
            <div className={styles.project_header}>
              <span className={styles.project_label} title={group.project.workspacePath}>
                {projectLabels.get(group.project.id) || getAgenticProjectDisplayLabel(group.project)}
              </span>
              <span className={styles.project_count}>{group.tasks.length}</span>
            </div>
            {group.tasks.map((task) => (
              <TaskRow
                active={false}
                key={task.sessionId}
                onActivate={(archivedTask) => {
                  if (group.project.availability === 'available') {
                    void workspaceSwitch.activateTask(archivedTask);
                  }
                }}
                onArchive={() => undefined}
                projectAvailable={group.project.availability === 'available'}
                task={task}
                onUnarchive={(archivedTask) => void unarchive(archivedTask)}
              />
            ))}
          </section>
        ))}
    </section>
  );
}

export function AgenticTaskList() {
  const registry = useInjectable<AgenticTaskRegistryService>(AgenticTaskRegistryService);
  const workspaceSwitch = useInjectable<AgenticWorkspaceSwitchService>(AgenticWorkspaceSwitchService);
  const aiChatService = useInjectable<AcpChatInternalService>(IChatInternalService);
  const windowDialogService = useInjectable<IWindowDialogService>(IWindowDialogService);
  const taskListRef = React.useRef<HTMLElement>(null);
  const [query, setQuery] = React.useState('');
  const [groups, setGroups] = React.useState<AgenticTaskGroup[]>([]);
  const [collapsedProjectIds, setCollapsedProjectIds] = React.useState<Set<string>>(() => new Set());
  const [projects, setProjects] = React.useState<AgenticProjectRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = React.useState<string>();
  const [activeAgentId, setActiveAgentId] = React.useState<string>();
  const [renameProject, setRenameProject] = React.useState<AgenticProjectRecord>();
  const [projectRevision, setProjectRevision] = React.useState(0);
  const [maximumTaskListWidth, setMaximumTaskListWidth] = React.useState(MAX_TASK_LIST_WIDTH);
  const preferredTaskListWidthRef = React.useRef<number>();
  const taskActivationVersionRef = React.useRef(0);
  const activeTaskContextVersionRef = React.useRef(0);
  const projectLabels = React.useMemo(() => getAgenticProjectDisplayLabels(projects), [projects]);

  const getConfiguredWidth = React.useCallback((maximumWidth: number) => {
    if (preferredTaskListWidthRef.current === undefined) {
      preferredTaskListWidthRef.current =
        getStoredTaskListWidth() ||
        getConfiguredTaskListWidth(getAgenticChatView(taskListRef.current), MAX_TASK_LIST_WIDTH);
    }
    return clampTaskListWidth(preferredTaskListWidthRef.current, maximumWidth);
  }, []);

  const refreshMaximumTaskListWidth = React.useCallback(() => {
    const chatView = getAgenticChatView(taskListRef.current);
    if (!chatView) {
      return MAX_TASK_LIST_WIDTH;
    }

    const maximumWidth = getTaskListMaximumWidth(chatView.getBoundingClientRect().width);
    setMaximumTaskListWidth(maximumWidth);
    chatView.style.setProperty('--agentic-task-list-max-width', `${maximumWidth}px`);
    chatView.style.setProperty('--agentic-task-list-width', `${getConfiguredWidth(maximumWidth)}px`);
    return maximumWidth;
  }, [getConfiguredWidth]);

  const resize = React.useCallback(
    (width: number) => {
      preferredTaskListWidthRef.current = width;
      storeTaskListWidth(width);
      const maximumWidth = refreshMaximumTaskListWidth();
      getAgenticChatView(taskListRef.current)?.style.setProperty(
        '--agentic-task-list-width',
        `${clampTaskListWidth(width, maximumWidth)}px`,
      );
    },
    [refreshMaximumTaskListWidth],
  );

  React.useEffect(() => {
    const chatView = getAgenticChatView(taskListRef.current);
    if (!chatView) {
      return;
    }

    refreshMaximumTaskListWidth();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(refreshMaximumTaskListWidth);
    observer.observe(chatView);
    return () => observer.disconnect();
  }, [refreshMaximumTaskListWidth]);

  const refreshProjectCatalog = React.useCallback(async () => {
    await workspaceSwitch.seedProjectCatalog();
    const projectCatalog = await registry.listProjects();
    await Promise.all(projectCatalog.map((project) => workspaceSwitch.refreshProjectAvailability(project)));
    const refreshedProjectCatalog = await registry.listProjects();
    setProjects(refreshedProjectCatalog);
    const projectIds = new Set(refreshedProjectCatalog.map((project) => project.id));
    setCollapsedProjectIds((currentIds) => {
      const retainedIds = new Set(Array.from(currentIds).filter((projectId) => projectIds.has(projectId)));
      return retainedIds.size === currentIds.size ? currentIds : retainedIds;
    });
    return refreshedProjectCatalog;
  }, [registry, workspaceSwitch]);

  const refresh = React.useCallback(async () => {
    await refreshProjectCatalog();
    const activeGroups = await registry.listActiveGroups(query);
    setGroups(filterGroups(activeGroups, query));
  }, [query, refreshProjectCatalog, registry]);

  React.useEffect(() => {
    let disposed = false;
    void refresh().catch(() => {
      if (!disposed) {
        setGroups([]);
      }
    });
    return () => {
      disposed = true;
    };
  }, [refresh]);

  const refreshActiveTaskContext = React.useCallback(
    async (requestedSessionId?: string) => {
      const refreshVersion = ++activeTaskContextVersionRef.current;
      const sessionModel = aiChatService.sessionModel;
      const sessionId = requestedSessionId || sessionModel?.sessionId;
      const activeTask = sessionId ? await registry.getTask(sessionId) : undefined;
      if (refreshVersion !== activeTaskContextVersionRef.current) {
        return;
      }
      const matchingSessionModel = sessionModel?.sessionId === sessionId ? sessionModel : undefined;
      setActiveSessionId(activeTask?.sessionId);
      setActiveAgentId(
        activeTask?.agentId ||
          matchingSessionModel?.requests?.at(-1)?.message.agentId ||
          aiChatService.getActiveAgenticTaskAgentId?.(sessionId),
      );
    },
    [aiChatService, registry],
  );

  React.useEffect(() => {
    void refreshActiveTaskContext();
    const disposable = aiChatService.onChangeSession?.(
      (sessionId) => void refreshActiveTaskContext(sessionId || undefined),
    );
    return () => disposable?.dispose();
  }, [aiChatService, refreshActiveTaskContext]);

  React.useEffect(() => {
    const disposable = registry.onDidChange(() => {
      setProjectRevision((revision) => revision + 1);
      void refresh();
      void refreshActiveTaskContext();
    });
    return () => disposable.dispose();
  }, [refresh, refreshActiveTaskContext, registry]);

  const attentionCount = groups.reduce(
    (count, group) => count + group.tasks.filter((task) => task.attention !== undefined).length,
    0,
  );
  const archive = React.useCallback(
    async (task: AgenticTaskRecord) => {
      if (!task.status || !ARCHIVABLE_STATUSES.has(task.status)) {
        return;
      }
      await registry.archive(task.sessionId);
      await refresh();
    },
    [refresh, registry],
  );

  const unarchive = React.useCallback(
    async (task: AgenticTaskRecord) => {
      const restored = await registry.unarchive(task.sessionId);
      if (restored) {
        await refresh();
      }
      return restored;
    },
    [refresh, registry],
  );

  const activate = React.useCallback(
    async (task: AgenticTaskRecord) => {
      const group = groups.find((candidate) => candidate.project.id === task.projectId);
      if (!group || group.project.availability === 'unavailable') {
        return;
      }
      const activationVersion = ++taskActivationVersionRef.current;
      if ((await workspaceSwitch.activateTask(task)) && activationVersion === taskActivationVersionRef.current) {
        setActiveSessionId(task.sessionId);
      }
    },
    [groups, workspaceSwitch],
  );

  const rename = React.useCallback(
    async (project: AgenticProjectRecord, label: string) => {
      await registry.renameProject(project.id, label);
    },
    [registry],
  );

  const remove = React.useCallback(
    async (project: AgenticProjectRecord) => {
      if (await registry.removeManagedProject(project.id)) {
        await refresh();
      }
    },
    [refresh, registry],
  );

  const addProject = React.useCallback(async () => {
    const directories = await windowDialogService.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      title: 'Add Project',
    });
    if (directories?.[0]) {
      await workspaceSwitch.addProject(directories[0]);
    }
  }, [windowDialogService, workspaceSwitch]);

  const toggleProjectExpanded = React.useCallback((projectId: string) => {
    setCollapsedProjectIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(projectId)) {
        nextIds.delete(projectId);
      } else {
        nextIds.add(projectId);
      }
      return nextIds;
    });
  }, []);

  const collapseDisabled = query.trim().length > 0;

  return (
    <aside aria-label='Agent Tasks' className={styles.task_list} data-testid='agentic-task-list' ref={taskListRef}>
      <TaskListResizeHandle
        getConfiguredWidth={getConfiguredWidth}
        maximumWidth={maximumTaskListWidth}
        onResize={resize}
        refreshMaximumWidth={refreshMaximumTaskListWidth}
      />
      <header className={styles.task_list_header}>
        <h2>Agent Tasks</h2>
        {attentionCount > 0 && <span className={styles.attention_count}>{attentionCount}</span>}
        <button
          aria-label='Add Project'
          className={styles.project_add}
          data-testid='agentic-project-add-button'
          onClick={() => void addProject()}
          title='Add Project'
          type='button'
        >
          <span aria-hidden='true' className='codicon codicon-new-folder' />
        </button>
      </header>
      <label className={styles.search}>
        <span aria-hidden='true' className='codicon codicon-search' />
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder='Search tasks'
          type='search'
          value={query}
        />
      </label>
      <div className={styles.task_groups}>
        {groups.map((group) => (
          <ProjectGroup
            activeSessionId={activeSessionId}
            collapseDisabled={collapseDisabled}
            expanded={collapseDisabled || !collapsedProjectIds.has(group.project.id)}
            group={group}
            key={group.project.id}
            onArchive={(task) => void archive(task)}
            onRemove={(project) => void remove(project)}
            onRename={setRenameProject}
            onTaskActivate={activate}
            onToggleExpanded={() => toggleProjectExpanded(group.project.id)}
            preferredAgentId={activeAgentId}
            projectLabel={projectLabels.get(group.project.id) || getAgenticProjectDisplayLabel(group.project)}
          />
        ))}
      </div>
      <ArchivedTaskGroups
        query={query}
        refreshProjectCatalog={refreshProjectCatalog}
        registry={registry}
        onUnarchive={unarchive}
        projectRevision={projectRevision}
        projectLabels={projectLabels}
        workspaceSwitch={workspaceSwitch}
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
