import React from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';

import {
  AgenticProjectRecord,
  AgenticTaskGroup,
  AgenticTaskRecord,
  AgenticTaskRegistryService,
  AgenticTaskStatus,
} from '../agentic-task-registry.service';
import { AgenticWorkspaceSwitchService } from '../agentic-workspace-switch.service';

import { AgenticTaskLaunchMenu } from './AgenticTaskLaunchMenu';
import styles from './agentic-task-list.module.less';

const DEFAULT_TASK_LIST_WIDTH = 244;
const MIN_TASK_LIST_WIDTH = 208;
const MAX_TASK_LIST_WIDTH = 280;
const ARCHIVABLE_STATUSES = new Set<AgenticTaskStatus>(['ready', 'stopped', 'error']);

function clampTaskListWidth(width: number): number {
  return Math.max(MIN_TASK_LIST_WIDTH, Math.min(MAX_TASK_LIST_WIDTH, width));
}

function filterGroups(groups: AgenticTaskGroup[], query: string): AgenticTaskGroup[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return groups
    .map((group) => ({
      project: group.project,
      tasks: group.tasks.filter((task) => !normalizedQuery || task.title.toLocaleLowerCase().includes(normalizedQuery)),
    }))
    .filter((group) => group.tasks.length > 0);
}

function getConfiguredTaskListWidth(): number {
  const chatView = document.querySelector<HTMLElement>('#ai_chat_view');
  const configuredWidth = Number.parseFloat(chatView?.style.getPropertyValue('--agentic-task-list-width') || '');
  return Number.isFinite(configuredWidth) ? clampTaskListWidth(configuredWidth) : DEFAULT_TASK_LIST_WIDTH;
}

function TaskListResizeHandle({ onResize }: { onResize: (width: number) => void }) {
  const [width, setWidth] = React.useState(DEFAULT_TASK_LIST_WIDTH);
  const resizeStart = React.useRef<{ clientX: number; width: number }>();

  const resize = React.useCallback(
    (nextWidth: number) => {
      const clampedWidth = clampTaskListWidth(nextWidth);
      setWidth(clampedWidth);
      onResize(clampedWidth);
    },
    [onResize],
  );

  return (
    <div
      aria-label='Resize Task List'
      aria-orientation='vertical'
      aria-valuemax={MAX_TASK_LIST_WIDTH}
      aria-valuemin={MIN_TASK_LIST_WIDTH}
      aria-valuenow={width}
      className={styles.resize_handle}
      data-testid='agentic-task-list-resize-handle'
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          resize(width - 8);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          resize(width + 8);
        }
      }}
      onPointerDown={(event) => {
        resizeStart.current = { clientX: event.clientX, width: getConfiguredTaskListWidth() };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!resizeStart.current) {
          return;
        }
        resize(resizeStart.current.width + event.clientX - resizeStart.current.clientX);
      }}
      onPointerUp={() => {
        resizeStart.current = undefined;
      }}
      role='separator'
      tabIndex={0}
    />
  );
}

function TaskState({ task }: { task: AgenticTaskRecord }) {
  if (task.attention) {
    return (
      <span
        aria-label={task.attention === 'permission' ? 'Permission needed' : 'Input needed'}
        className={`${styles.task_state} ${styles[`task_attention_${task.attention}`]}`}
        data-testid={`agentic-task-attention-${task.sessionId}`}
      />
    );
  }

  return (
    <span
      aria-label={task.status || 'Unknown task state'}
      className={`${styles.task_state} ${task.status ? styles[`task_status_${task.status}`] : ''}`}
      data-testid={`agentic-task-status-${task.sessionId}`}
    />
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

  return (
    <div className={styles.task_row_wrap}>
      <button
        aria-current={active ? 'true' : undefined}
        className={`${styles.task_row} ${active ? styles.task_row_selected : ''}`}
        data-testid={`agentic-task-row-${task.sessionId}`}
        disabled={!projectAvailable}
        onClick={() => onActivate(task)}
        title={projectAvailable ? task.title : `${task.title} (Project unavailable)`}
        type='button'
      >
        <TaskState task={task} />
        <span className={styles.task_copy}>
          <span className={styles.task_title}>{task.title}</span>
          <span className={styles.task_subtitle}>
            {task.agentId}
            {task.status ? ` · ${task.status}` : ''}
          </span>
        </span>
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
          type='button'
        >
          Archive
        </button>
      )}
      {task.archived && onUnarchive && (
        <button
          aria-label={`Unarchive ${task.title}`}
          className={styles.archive_button}
          data-testid={`agentic-task-unarchive-${task.sessionId}`}
          onClick={() => onUnarchive(task)}
          type='button'
        >
          Unarchive
        </button>
      )}
    </div>
  );
}

function ProjectGroup({
  activeSessionId,
  group,
  onArchive,
  onLaunch,
  onTaskActivate,
}: {
  activeSessionId: string | undefined;
  group: AgenticTaskGroup;
  onArchive: (task: AgenticTaskRecord) => void;
  onLaunch: (project: AgenticProjectRecord) => void;
  onTaskActivate: (task: AgenticTaskRecord) => void;
}) {
  const projectAvailable = group.project.availability === 'available';

  return (
    <section className={styles.project_group} data-testid='agentic-task-project-group'>
      <header className={styles.project_header}>
        <span className={styles.project_label} title={group.project.workspacePath}>
          ▾ {group.project.label}
        </span>
        <span className={styles.project_count}>{group.tasks.length}</span>
        <button
          aria-label={`New Task in ${group.project.label}`}
          className={styles.project_new_task}
          disabled={!projectAvailable}
          onClick={() => onLaunch(group.project)}
          type='button'
        >
          +
        </button>
      </header>
      {group.tasks.map((task) => (
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
  query,
  refreshProjectCatalog,
  registry,
  onUnarchive,
  workspaceSwitch,
}: {
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
  }, [expanded, query, refreshProjectCatalog, registry]);

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
        <span aria-hidden='true'>{expanded ? '▾' : '▸'}</span> Archived Tasks
      </button>
      {expanded &&
        groups.map((group) => (
          <section className={styles.archived_project_group} key={group.project.id}>
            <div className={styles.project_header}>
              <span className={styles.project_label}>{group.project.label}</span>
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
  const [query, setQuery] = React.useState('');
  const [groups, setGroups] = React.useState<AgenticTaskGroup[]>([]);
  const [projects, setProjects] = React.useState<AgenticProjectRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = React.useState<string>();
  const [launchProject, setLaunchProject] = React.useState<AgenticProjectRecord>();

  const resize = React.useCallback((width: number) => {
    document
      .querySelector<HTMLElement>('#ai_chat_view')
      ?.style.setProperty('--agentic-task-list-width', `${clampTaskListWidth(width)}px`);
  }, []);

  const refreshProjectCatalog = React.useCallback(async () => {
    await workspaceSwitch.seedProjectCatalog();
    const projectCatalog = await registry.listProjects();
    await Promise.all(projectCatalog.map((project) => workspaceSwitch.refreshProjectAvailability(project)));
    return registry.listProjects();
  }, [registry, workspaceSwitch]);

  const refresh = React.useCallback(async () => {
    const projectCatalog = await refreshProjectCatalog();
    const activeGroups = await registry.listActiveGroups(query);
    setProjects(projectCatalog);
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

  React.useEffect(() => {
    const disposable = registry.onDidChange(() => {
      void refresh();
    });
    return () => disposable.dispose();
  }, [refresh, registry]);

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
    (task: AgenticTaskRecord) => {
      const group = groups.find((candidate) => candidate.project.id === task.projectId);
      if (!group || group.project.availability === 'unavailable') {
        return;
      }
      setActiveSessionId(task.sessionId);
      void workspaceSwitch.activateTask(task);
    },
    [groups, workspaceSwitch],
  );

  return (
    <aside aria-label='Task List' className={styles.task_list} data-testid='agentic-task-list'>
      <TaskListResizeHandle onResize={resize} />
      <header className={styles.task_list_header}>
        <h2>Task List</h2>
        {attentionCount > 0 && <span className={styles.attention_count}>{attentionCount}</span>}
        <AgenticTaskLaunchMenu
          onOpenChange={(open) => {
            if (!open) {
              setLaunchProject(undefined);
            }
          }}
          open={launchProject ? true : undefined}
          projects={launchProject ? [launchProject] : projects}
        />
      </header>
      <label className={styles.search}>
        <span aria-hidden='true'>⌕</span>
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
            group={group}
            key={group.project.id}
            onArchive={(task) => void archive(task)}
            onLaunch={setLaunchProject}
            onTaskActivate={activate}
          />
        ))}
      </div>
      <ArchivedTaskGroups
        query={query}
        refreshProjectCatalog={refreshProjectCatalog}
        registry={registry}
        onUnarchive={unarchive}
        workspaceSwitch={workspaceSwitch}
      />
    </aside>
  );
}
