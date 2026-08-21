import { Autowired, Injectable } from '@opensumi/di';
import { Emitter, Event, IStorage, STORAGE_NAMESPACE, StorageProvider, URI } from '@opensumi/ide-core-common';

const TASK_REGISTRY_STORAGE_KEY = 'agentic.task-registry.v2';
const PENDING_TASK_ACTIVATION_STORAGE_KEY = 'agentic.pending-task-activation.v2';
const PENDING_TASK_LAUNCH_STORAGE_KEY = 'agentic.pending-task-launch.v2';
const ACTIVE_TASK_SESSION_STORAGE_KEY = 'agentic.active-task-session.v1';
const ARCHIVED_AGENT_SESSIONS_STORAGE_KEY = 'agentic.archived-agent-sessions.v1';

const ARCHIVABLE_STATUSES = new Set<AgenticTaskStatus>(['ready', 'stopped', 'error']);

export interface AgenticProjectRecord {
  id: string;
  workspaceUri: string;
  workspacePath: string;
  label?: string;
  managed?: true;
  lastAgentId?: string;
  joinedAt: number;
  availability: 'available' | 'unavailable';
}

export interface AgenticTaskRecord {
  sessionId: string;
  projectId: string;
  agentId: string;
  title: string;
  createdAt: number;
  archived: boolean;
  unread: boolean;
  status?: AgenticTaskStatus;
  attention?: 'permission' | 'input';
}

export type AgenticTaskStatus = 'ready' | 'running' | 'stopping' | 'stopped' | 'error';

export interface AgenticTaskGroup {
  project: AgenticProjectRecord;
  tasks: AgenticTaskRecord[];
}

export interface AgenticArchivedSessionIdentity {
  sessionId: string;
  agentId: string;
  cwd: string;
}

export interface AgenticArchivedSessionRecord extends AgenticArchivedSessionIdentity {
  archivedAt: number;
}

export interface AgenticTaskRegistryState {
  version: 3;
  projects: AgenticProjectRecord[];
  tasks: AgenticTaskRecord[];
}

export type AgenticProjectRegistration = Omit<AgenticProjectRecord, 'id'> & { id?: string };

export interface RegisterFirstPromptOptions {
  sessionId: string;
  agentId: string;
  project: AgenticProjectRegistration;
  firstPrompt: string;
  createdAt: number;
}

export interface AgenticPendingTaskActivation {
  sessionId: string;
}

export interface AgenticPendingTaskLaunch {
  projectId: string;
  agentId: string;
}

@Injectable()
export class AgenticTaskRegistryService {
  @Autowired(StorageProvider)
  private storageProvider: StorageProvider;

  private storage: IStorage | undefined;
  private state: AgenticTaskRegistryState | undefined;
  private archivedAgentSessions: AgenticArchivedSessionRecord[] = [];
  private initialization: Promise<void> | undefined;
  private readonly onDidChangeEmitter = new Emitter<void>();
  readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;

  async registerProject(project: AgenticProjectRegistration): Promise<AgenticProjectRecord> {
    await this.ensureInitialized();

    const normalized = this.normalizeProject(project);
    if (!normalized) {
      throw new Error('A project must include a workspace URI, path, label, and join time.');
    }

    const existing = this.findProject(normalized.id);
    if (existing) {
      return { ...existing };
    }

    this.currentState.projects.push(normalized);
    await this.persist();
    return { ...normalized };
  }

  async registerManagedProject(project: AgenticProjectRegistration): Promise<AgenticProjectRecord> {
    await this.ensureInitialized();

    const normalized = this.normalizeProject({ ...project, managed: true });
    if (!normalized) {
      throw new Error('A managed project must include a workspace URI, path, and join time.');
    }

    const existing = this.findProject(normalized.id);
    if (existing) {
      if (!existing.managed || existing.availability !== normalized.availability) {
        existing.managed = true;
        existing.availability = normalized.availability;
        await this.persist();
      }
      return { ...existing };
    }

    this.currentState.projects.push(normalized);
    await this.persist();
    return { ...normalized };
  }

  async removeManagedProject(projectId: string): Promise<boolean> {
    await this.ensureInitialized();
    const project = this.findProject(projectId);
    if (!project || !project.managed || this.currentState.tasks.some((task) => task.projectId === projectId)) {
      return false;
    }

    this.currentState.projects = this.currentState.projects.filter((candidate) => candidate.id !== projectId);
    await this.persist();
    return true;
  }

  /**
   * Remove a Project from the Agent session catalog without deleting legacy
   * Task records. Legacy records are intentionally retained but are no longer
   * a runtime source for Agentic Layout.
   */
  async removeManagedSessionProject(projectId: string): Promise<boolean> {
    await this.ensureInitialized();
    const project = this.findProject(projectId);
    if (!project?.managed) {
      return false;
    }
    this.currentState.projects = this.currentState.projects.filter((candidate) => candidate.id !== projectId);
    await this.persist();
    return true;
  }

  async registerFirstPrompt(options: RegisterFirstPromptOptions): Promise<AgenticTaskRecord> {
    await this.ensureInitialized();
    const project = await this.registerProject(options.project);
    const existing = this.findTask(options.sessionId);
    if (existing) {
      return { ...existing };
    }

    const task: AgenticTaskRecord = {
      sessionId: options.sessionId,
      projectId: project.id,
      agentId: options.agentId,
      title: this.titleFromFirstPrompt(options.firstPrompt),
      createdAt: options.createdAt,
      archived: false,
      unread: false,
    };
    this.currentState.tasks.push(task);
    const storedProject = this.findProject(project.id);
    if (storedProject && storedProject.lastAgentId !== options.agentId) {
      storedProject.lastAgentId = options.agentId;
    }
    await this.persist();
    return { ...task };
  }

  async rememberProjectAgent(projectId: string, agentId: string): Promise<AgenticProjectRecord | undefined> {
    await this.ensureInitialized();
    const project = this.findProject(projectId);
    const normalizedAgentId = agentId.trim();
    if (!project || !normalizedAgentId) {
      return undefined;
    }
    if (project.lastAgentId === normalizedAgentId) {
      return { ...project };
    }

    project.lastAgentId = normalizedAgentId;
    await this.persist();
    return { ...project };
  }

  async getProject(projectId: string): Promise<AgenticProjectRecord | undefined> {
    await this.ensureInitialized();
    const project = this.findProject(projectId);
    return project && { ...project };
  }

  async listProjects(): Promise<AgenticProjectRecord[]> {
    await this.ensureInitialized();
    return [...this.currentState.projects].sort((a, b) => b.joinedAt - a.joinedAt).map((project) => ({ ...project }));
  }

  async getTask(sessionId: string): Promise<AgenticTaskRecord | undefined> {
    await this.ensureInitialized();
    const task = this.findTask(sessionId);
    return task && { ...task };
  }

  async listActiveGroups(query?: string): Promise<AgenticTaskGroup[]> {
    return this.listGroups(false, query);
  }

  async listArchivedGroups(query?: string): Promise<AgenticTaskGroup[]> {
    return this.listGroups(true, query);
  }

  async listArchivedAgentSessions(): Promise<AgenticArchivedSessionRecord[]> {
    await this.ensureInitialized();
    return [...this.archivedAgentSessions]
      .sort((a, b) => b.archivedAt - a.archivedAt)
      .map((session) => ({ ...session }));
  }

  async archiveAgentSession(session: AgenticArchivedSessionIdentity): Promise<boolean> {
    await this.ensureInitialized();
    const normalized = this.normalizeArchivedAgentSession({ ...session, archivedAt: Date.now() });
    if (
      !normalized ||
      this.archivedAgentSessions.some((candidate) => this.matchesArchivedSession(candidate, session))
    ) {
      return false;
    }
    this.archivedAgentSessions.push(normalized);
    await this.persistArchivedAgentSessions();
    return true;
  }

  async unarchiveAgentSession(session: AgenticArchivedSessionIdentity): Promise<boolean> {
    await this.ensureInitialized();
    const next = this.archivedAgentSessions.filter((candidate) => !this.matchesArchivedSession(candidate, session));
    if (next.length === this.archivedAgentSessions.length) {
      return false;
    }
    this.archivedAgentSessions = next;
    await this.persistArchivedAgentSessions();
    return true;
  }

  async markUnread(sessionId: string, unread = true): Promise<AgenticTaskRecord | undefined> {
    return this.updateTask(sessionId, (task) => {
      task.unread = unread;
    });
  }

  async updateStatus(sessionId: string, status?: AgenticTaskStatus): Promise<AgenticTaskRecord | undefined> {
    return this.updateTask(sessionId, (task) => {
      if (status === undefined) {
        delete task.status;
      } else {
        task.status = status;
      }
    });
  }

  async updateAttention(
    sessionId: string,
    attention?: AgenticTaskRecord['attention'],
  ): Promise<AgenticTaskRecord | undefined> {
    return this.updateTask(sessionId, (task) => {
      if (attention === undefined) {
        delete task.attention;
      } else {
        task.attention = attention;
      }
    });
  }

  async markProjectAvailability(
    projectId: string,
    availability: AgenticProjectRecord['availability'],
  ): Promise<AgenticProjectRecord | undefined> {
    await this.ensureInitialized();
    const project = this.findProject(projectId);
    if (!project) {
      return undefined;
    }

    if (project.availability === availability) {
      return { ...project };
    }

    project.availability = availability;
    await this.persist();
    return { ...project };
  }

  async renameProject(projectId: string, label: string): Promise<AgenticProjectRecord | undefined> {
    await this.ensureInitialized();
    const project = this.findProject(projectId);
    if (!project) {
      return undefined;
    }

    const normalizedLabel = label.trim();
    if (normalizedLabel) {
      project.label = normalizedLabel;
    } else {
      delete project.label;
    }
    await this.persist();
    return { ...project };
  }

  async archive(sessionId: string): Promise<boolean> {
    await this.ensureInitialized();
    const task = this.findTask(sessionId);
    if (!task || task.archived || !task.status || !ARCHIVABLE_STATUSES.has(task.status)) {
      return false;
    }

    task.archived = true;
    await this.persist();
    return true;
  }

  async archiveUnavailable(sessionId: string): Promise<boolean> {
    await this.ensureInitialized();
    const task = this.findTask(sessionId);
    if (!task || task.archived) {
      return false;
    }

    task.archived = true;
    await this.persist();
    return true;
  }

  async unarchive(sessionId: string): Promise<boolean> {
    await this.ensureInitialized();
    const task = this.findTask(sessionId);
    if (!task || !task.archived) {
      return false;
    }

    task.archived = false;
    await this.persist();
    return true;
  }

  preparePendingActivation(activation: AgenticPendingTaskActivation): void {
    if (typeof activation?.sessionId !== 'string') {
      return;
    }

    this.writeSessionValue(PENDING_TASK_ACTIVATION_STORAGE_KEY, { sessionId: activation.sessionId });
  }

  consumePendingActivation(): AgenticPendingTaskActivation | undefined {
    const value = this.consumeSessionValue(PENDING_TASK_ACTIVATION_STORAGE_KEY);
    if (!this.isRecord(value) || typeof value.sessionId !== 'string') {
      return undefined;
    }

    return { sessionId: value.sessionId };
  }

  rememberActiveTaskSession(sessionId: string): void {
    this.writeSessionValue(ACTIVE_TASK_SESSION_STORAGE_KEY, { sessionId });
  }

  getRememberedActiveTaskSession(): AgenticPendingTaskActivation | undefined {
    const value = this.readSessionValue(ACTIVE_TASK_SESSION_STORAGE_KEY);
    if (!this.isRecord(value) || typeof value.sessionId !== 'string') {
      return undefined;
    }
    return { sessionId: value.sessionId };
  }

  clearRememberedActiveTaskSession(sessionId?: string): void {
    const remembered = this.getRememberedActiveTaskSession();
    if (sessionId && remembered?.sessionId !== sessionId) {
      return;
    }
    this.removeSessionValue(ACTIVE_TASK_SESSION_STORAGE_KEY);
  }

  preparePendingLaunch(launch: AgenticPendingTaskLaunch): void {
    if (typeof launch?.projectId !== 'string' || typeof launch.agentId !== 'string') {
      return;
    }

    this.writeSessionValue(PENDING_TASK_LAUNCH_STORAGE_KEY, {
      projectId: launch.projectId,
      agentId: launch.agentId,
    });
  }

  clearPendingLaunch(): void {
    this.removeSessionValue(PENDING_TASK_LAUNCH_STORAGE_KEY);
  }

  consumePendingLaunch(): AgenticPendingTaskLaunch | undefined {
    const value = this.consumeSessionValue(PENDING_TASK_LAUNCH_STORAGE_KEY);
    if (!this.isRecord(value) || typeof value.projectId !== 'string' || typeof value.agentId !== 'string') {
      return undefined;
    }

    return { projectId: value.projectId, agentId: value.agentId };
  }

  private async listGroups(archived: boolean, query?: string): Promise<AgenticTaskGroup[]> {
    const normalizedQuery = query?.trim().toLocaleLowerCase();
    const projects = await this.listProjects();

    return projects.reduce<AgenticTaskGroup[]>((groups, project) => {
      if (project.availability === 'unavailable') {
        return groups;
      }

      const tasks = this.currentState.tasks
        .filter(
          (task) =>
            task.projectId === project.id &&
            task.archived === archived &&
            (!normalizedQuery || task.title.toLocaleLowerCase().includes(normalizedQuery)),
        )
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((task) => ({ ...task }));

      if (tasks.length || (!archived && !normalizedQuery && project.managed)) {
        groups.push({ project: { ...project }, tasks });
      }
      return groups;
    }, []);
  }

  private async updateTask(
    sessionId: string,
    update: (task: AgenticTaskRecord) => void,
  ): Promise<AgenticTaskRecord | undefined> {
    await this.ensureInitialized();
    const task = this.findTask(sessionId);
    if (!task) {
      return undefined;
    }

    update(task);
    await this.persist();
    return { ...task };
  }

  private async ensureInitialized(): Promise<void> {
    if (this.state) {
      return;
    }

    if (!this.initialization) {
      this.initialization = this.initialize();
    }

    await this.initialization;
  }

  private async initialize(): Promise<void> {
    this.storage = await this.storageProvider(STORAGE_NAMESPACE.GLOBAL_RECENT_DATA);
    this.state = this.normalizeState(this.storage.get<unknown>(TASK_REGISTRY_STORAGE_KEY));
    this.archivedAgentSessions = this.normalizeArchivedAgentSessions(
      this.storage.get<unknown>(ARCHIVED_AGENT_SESSIONS_STORAGE_KEY),
    );
  }

  private get currentState(): AgenticTaskRegistryState {
    if (!this.state) {
      throw new Error('Agentic task registry has not initialized.');
    }
    return this.state;
  }

  private async persist(): Promise<void> {
    await this.storage?.set(TASK_REGISTRY_STORAGE_KEY, JSON.stringify(this.currentState));
    this.onDidChangeEmitter.fire();
  }

  private async persistArchivedAgentSessions(): Promise<void> {
    await this.storage?.set(ARCHIVED_AGENT_SESSIONS_STORAGE_KEY, JSON.stringify(this.archivedAgentSessions));
    this.onDidChangeEmitter.fire();
  }

  private normalizeArchivedAgentSessions(value: unknown): AgenticArchivedSessionRecord[] {
    const source = typeof value === 'string' ? this.parseJSON(value) : value;
    if (!Array.isArray(source)) {
      return [];
    }
    const keys = new Set<string>();
    const sessions: AgenticArchivedSessionRecord[] = [];
    for (const value of source) {
      const session = this.normalizeArchivedAgentSession(value);
      if (!session) {
        continue;
      }
      const key = this.archivedSessionKey(session);
      if (!keys.has(key)) {
        keys.add(key);
        sessions.push(session);
      }
    }
    return sessions;
  }

  private normalizeArchivedAgentSession(value: unknown): AgenticArchivedSessionRecord | undefined {
    if (
      !this.isRecord(value) ||
      typeof value.sessionId !== 'string' ||
      typeof value.agentId !== 'string' ||
      typeof value.cwd !== 'string' ||
      typeof value.archivedAt !== 'number' ||
      !Number.isFinite(value.archivedAt)
    ) {
      return undefined;
    }
    const sessionId = value.sessionId.trim();
    const agentId = value.agentId.trim();
    const cwd = value.cwd.trim();
    if (!sessionId || !agentId || !cwd) {
      return undefined;
    }
    return { sessionId, agentId, cwd, archivedAt: value.archivedAt };
  }

  private matchesArchivedSession(
    candidate: AgenticArchivedSessionIdentity,
    session: AgenticArchivedSessionIdentity,
  ): boolean {
    return this.archivedSessionKey(candidate) === this.archivedSessionKey(session);
  }

  private archivedSessionKey(session: AgenticArchivedSessionIdentity): string {
    return JSON.stringify([session.agentId, session.cwd, session.sessionId]);
  }

  private normalizeState(value: unknown): AgenticTaskRegistryState {
    const source = typeof value === 'string' ? this.parseJSON(value) : value;
    if (
      !this.isRecord(source) ||
      (source.version !== 2 && source.version !== 3) ||
      !Array.isArray(source.projects) ||
      !Array.isArray(source.tasks)
    ) {
      return { version: 3, projects: [], tasks: [] };
    }

    const projects: AgenticProjectRecord[] = [];
    const projectIds = new Set<string>();
    source.projects.forEach((project) => {
      const normalized = this.normalizeProject(project, source.version === 3);
      if (normalized && !projectIds.has(normalized.id)) {
        if (source.version === 3 && !normalized.managed && normalized.label) {
          normalized.managed = true;
        }
        projectIds.add(normalized.id);
        projects.push(normalized);
      }
    });

    const taskIds = new Set<string>();
    const tasks: AgenticTaskRecord[] = [];
    source.tasks.forEach((task) => {
      const normalized = this.normalizeTask(task);
      if (normalized && projectIds.has(normalized.projectId) && !taskIds.has(normalized.sessionId)) {
        taskIds.add(normalized.sessionId);
        tasks.push(normalized);
      }
    });

    return {
      version: 3,
      projects,
      tasks,
    };
  }

  private normalizeProject(value: unknown, preserveLabel = true): AgenticProjectRecord | undefined {
    if (!this.isRecord(value) || !this.isProjectAvailability(value.availability)) {
      return undefined;
    }
    if (
      typeof value.workspaceUri !== 'string' ||
      typeof value.workspacePath !== 'string' ||
      typeof value.joinedAt !== 'number' ||
      !Number.isFinite(value.joinedAt)
    ) {
      return undefined;
    }

    const workspaceUri = this.toCanonicalWorkspaceUri(value.workspaceUri);
    const label = preserveLabel && typeof value.label === 'string' ? value.label.trim() : '';
    const lastAgentId = typeof value.lastAgentId === 'string' ? value.lastAgentId.trim() : '';
    return {
      id: workspaceUri,
      workspaceUri,
      workspacePath: value.workspacePath,
      joinedAt: value.joinedAt,
      availability: value.availability,
      ...(label ? { label } : {}),
      ...(value.managed === true ? { managed: true as const } : {}),
      ...(lastAgentId ? { lastAgentId } : {}),
    };
  }

  private normalizeTask(value: unknown): AgenticTaskRecord | undefined {
    if (
      !this.isRecord(value) ||
      typeof value.sessionId !== 'string' ||
      typeof value.projectId !== 'string' ||
      typeof value.agentId !== 'string' ||
      typeof value.title !== 'string' ||
      typeof value.createdAt !== 'number' ||
      !Number.isFinite(value.createdAt) ||
      typeof value.archived !== 'boolean' ||
      typeof value.unread !== 'boolean' ||
      (value.status !== undefined && !this.isAgenticTaskStatus(value.status)) ||
      (value.attention !== undefined && value.attention !== 'permission' && value.attention !== 'input')
    ) {
      return undefined;
    }

    return {
      sessionId: value.sessionId,
      projectId: value.projectId,
      agentId: value.agentId,
      title: value.title,
      createdAt: value.createdAt,
      archived: value.archived,
      unread: value.unread,
      ...(value.status === undefined ? {} : { status: value.status }),
      ...(value.attention === undefined ? {} : { attention: value.attention }),
    };
  }

  private findProject(projectId: string): AgenticProjectRecord | undefined {
    return this.currentState.projects.find((project) => project.id === projectId);
  }

  private findTask(sessionId: string): AgenticTaskRecord | undefined {
    return this.currentState.tasks.find((task) => task.sessionId === sessionId);
  }

  private titleFromFirstPrompt(firstPrompt: string): string {
    return firstPrompt.split(/\r?\n/, 1)[0].trim() || 'New Task';
  }

  private toCanonicalWorkspaceUri(workspaceUri: string): string {
    try {
      return new URI(workspaceUri).toString();
    } catch {
      return workspaceUri;
    }
  }

  private writeSessionValue(key: string, value: object): void {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Session-only pending state is best effort and must not block the caller.
    }
  }

  private consumeSessionValue(key: string): unknown {
    try {
      const value = window.sessionStorage.getItem(key);
      window.sessionStorage.removeItem(key);
      return value ? this.parseJSON(value) : undefined;
    } catch {
      return undefined;
    }
  }

  private readSessionValue(key: string): unknown {
    try {
      const value = window.sessionStorage.getItem(key);
      return value ? this.parseJSON(value) : undefined;
    } catch {
      return undefined;
    }
  }

  private removeSessionValue(key: string): void {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Session-only UI state is best effort and must not block the caller.
    }
  }

  private parseJSON(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  private isProjectAvailability(value: unknown): value is AgenticProjectRecord['availability'] {
    return value === 'available' || value === 'unavailable';
  }

  private isAgenticTaskStatus(value: unknown): value is AgenticTaskStatus {
    return value === 'ready' || value === 'running' || value === 'stopping' || value === 'stopped' || value === 'error';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}
