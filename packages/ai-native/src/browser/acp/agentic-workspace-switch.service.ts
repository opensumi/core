import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Emitter, URI } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IChatInternalService } from '../../common';
import {
  AcpChatInternalService,
  type AgenticTaskSessionActivationStatus,
  type AgenticTaskSessionValidationResult,
} from '../chat/chat.internal.service.acp';
import {
  getAvailableAgentConfigs,
  getConfiguredAgentConfigs,
  getDefaultAgentType,
} from '../chat/get-default-agent-type';

import {
  AgenticProjectRecord,
  AgenticTaskRecord,
  AgenticTaskRegistryService,
  AgenticTaskStatus,
} from './agentic-task-registry.service';

const ARCHIVABLE_TASK_STATUSES = new Set<AgenticTaskStatus>(['ready', 'stopped', 'error']);

export function isAgenticTaskStatusArchivable(status: AgenticTaskStatus | undefined): boolean {
  return Boolean(status && ARCHIVABLE_TASK_STATUSES.has(status));
}

export interface AgenticHeaderTaskLaunchContext {
  project?: AgenticProjectRecord;
  preferredAgentId?: string;
  executionContext?: AgenticProjectRecord;
}

export type AgenticHeaderTaskLaunchStatus =
  | 'launched'
  | 'busy'
  | 'no-agent'
  | 'no-project'
  | 'project-unavailable'
  | 'failed';

export interface AgenticHeaderTaskLaunchResult {
  status: AgenticHeaderTaskLaunchStatus;
}

export type AgenticTaskActivationStatus =
  | AgenticTaskSessionActivationStatus
  | 'project-unavailable'
  | 'agent-unavailable';

export interface AgenticTaskActivationResult {
  status: AgenticTaskActivationStatus;
}

export type AgenticTaskValidationResult =
  | AgenticTaskSessionValidationResult
  | { status: 'project-unavailable' | 'agent-unavailable' };

export interface AgenticTaskArchiveResult {
  status: 'archived' | 'not-archivable' | 'failed';
  availability?: 'conversation-unavailable' | 'agent-unavailable';
}

type AgenticTaskRouteResult =
  | { status: 'ready' }
  | { status: 'superseded' | 'failed' | 'project-unavailable' | 'agent-unavailable' };

@Injectable()
export class AgenticWorkspaceSwitchService {
  @Autowired(AgenticTaskRegistryService)
  private readonly registry: AgenticTaskRegistryService;

  @Autowired(IChatInternalService)
  private readonly aiChatService: AcpChatInternalService;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(IFileServiceClient)
  private readonly fileService: IFileServiceClient;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  private taskActionGeneration = 0;
  private taskLaunchPending = false;
  private readonly onDidChangeTaskLaunchPendingEmitter = new Emitter<boolean>();

  readonly onDidChangeTaskLaunchPending = this.onDidChangeTaskLaunchPendingEmitter.event;

  get isTaskLaunchPending(): boolean {
    return this.taskLaunchPending;
  }

  async seedProjectCatalog(): Promise<void> {
    await this.workspaceService.whenReady;
  }

  async addProject(workspaceUri: URI): Promise<AgenticProjectRecord | undefined> {
    if (workspaceUri.scheme !== 'file') {
      return undefined;
    }

    try {
      const stat = await this.fileService.getFileStat(workspaceUri.toString(), false);
      if (!stat || !stat.isDirectory) {
        return undefined;
      }

      return this.registry.registerManagedProject({
        workspaceUri: workspaceUri.toString(),
        workspacePath: workspaceUri.codeUri.fsPath,
        joinedAt: Date.now(),
        availability: 'available',
      });
    } catch {
      return undefined;
    }
  }

  async activateTask(task: AgenticTaskRecord): Promise<AgenticTaskActivationResult> {
    const actionGeneration = ++this.taskActionGeneration;
    const shouldApply = () => actionGeneration === this.taskActionGeneration;
    const route = await this.prepareTaskRoute(task, shouldApply);
    if (route.status !== 'ready') {
      return route;
    }

    const result = await this.aiChatService.activateAgenticTaskSession(task.sessionId, shouldApply);
    if (!shouldApply()) {
      return { status: 'superseded' };
    }
    if (result.status === 'activated') {
      await this.registry.markUnread(task.sessionId, false);
    }
    return result;
  }

  async validateTaskSession(task: AgenticTaskRecord): Promise<AgenticTaskValidationResult> {
    const actionGeneration = ++this.taskActionGeneration;
    const shouldApply = () => actionGeneration === this.taskActionGeneration;
    const route = await this.prepareTaskRoute(task, shouldApply);
    if (route.status !== 'ready') {
      return route;
    }

    if (this.aiChatService.isAgenticTaskSessionObserved(task.sessionId)) {
      const taskStatus = this.aiChatService.getObservedAgenticTaskStatus(task.sessionId);
      return taskStatus ? { status: 'validated', taskStatus } : { status: 'failed' };
    }

    return this.aiChatService.validateAgenticTaskSession(task.sessionId, shouldApply);
  }

  async archiveTask(
    task: AgenticTaskRecord,
    options: { conversationUnavailable: boolean },
  ): Promise<AgenticTaskArchiveResult> {
    if (options.conversationUnavailable) {
      const archived = await this.registry.archiveUnavailable(task.sessionId);
      return {
        status: archived ? 'archived' : 'failed',
        availability: 'conversation-unavailable',
      };
    }

    if (!getAvailableAgentConfigs(this.preferenceService)[task.agentId]) {
      const archived = await this.registry.archiveUnavailable(task.sessionId);
      return { status: archived ? 'archived' : 'failed', availability: 'agent-unavailable' };
    }

    if (this.aiChatService.isAgenticTaskSessionObserved(task.sessionId)) {
      const status = this.aiChatService.getObservedAgenticTaskStatus(task.sessionId);
      if (!isAgenticTaskStatusArchivable(status)) {
        return { status: 'not-archivable' };
      }
      return { status: (await this.registry.archive(task.sessionId)) ? 'archived' : 'failed' };
    }

    const validation = await this.validateTaskSession(task);
    if (validation.status === 'validated') {
      if (!isAgenticTaskStatusArchivable(validation.taskStatus)) {
        return { status: 'not-archivable' };
      }
      return { status: (await this.registry.archive(task.sessionId)) ? 'archived' : 'failed' };
    }
    if (validation.status === 'conversation-unavailable' || validation.status === 'agent-unavailable') {
      const archived = await this.registry.archiveUnavailable(task.sessionId);
      return {
        status: archived ? 'archived' : 'failed',
        availability: validation.status,
      };
    }
    return { status: validation.status === 'failed' ? 'failed' : 'not-archivable' };
  }

  private async prepareTaskRoute(task: AgenticTaskRecord, shouldApply: () => boolean): Promise<AgenticTaskRouteResult> {
    const project = await this.registry.getProject(task.projectId);
    if (!shouldApply()) {
      return { status: 'superseded' };
    }
    if (!project) {
      return { status: 'failed' };
    }

    const available = await this.ensureProjectAvailable(project);
    if (!shouldApply()) {
      return { status: 'superseded' };
    }
    if (!available) {
      return { status: 'project-unavailable' };
    }
    if (!getAvailableAgentConfigs(this.preferenceService)[task.agentId]) {
      return { status: 'agent-unavailable' };
    }
    return { status: 'ready' };
  }

  async launchTask(project: AgenticProjectRecord, agentId: string): Promise<boolean> {
    if (!this.beginTaskLaunch()) {
      return false;
    }

    try {
      return await this.performTaskLaunch(project, agentId);
    } finally {
      this.finishTaskLaunch();
    }
  }

  private async performTaskLaunch(project: AgenticProjectRecord, agentId: string): Promise<boolean> {
    const actionGeneration = ++this.taskActionGeneration;
    const shouldApply = () => actionGeneration === this.taskActionGeneration;
    const registeredProject = await this.registry.getProject(project.id);
    if (!shouldApply()) {
      return false;
    }
    const currentWorkspaceProject = this.currentWorkspaceProject();
    const isCurrentWorkspace =
      !!currentWorkspaceProject && project.workspaceUri === currentWorkspaceProject.workspaceUri;
    const targetProject = registeredProject || (isCurrentWorkspace ? currentWorkspaceProject : undefined);
    if (!targetProject) {
      return false;
    }

    if (registeredProject) {
      const available = await this.ensureProjectAvailable(registeredProject);
      if (!shouldApply() || !available) {
        return false;
      }
    }

    this.aiChatService.enterAgenticTaskDraft({ agentId, cwd: targetProject.workspacePath });
    return true;
  }

  async resolveHeaderTaskLaunchContext(): Promise<AgenticHeaderTaskLaunchContext> {
    const sessionModel = this.aiChatService.sessionModel;
    const currentWorkspaceProject = this.currentWorkspaceProject();
    const persistedCurrentProject = currentWorkspaceProject
      ? await this.registry.getProject(currentWorkspaceProject.id)
      : undefined;
    const activeTarget = this.aiChatService.getActiveAgenticTaskTarget(sessionModel?.sessionId);
    const projects = activeTarget ? await this.registry.listProjects() : [];
    const activeSessionProject = activeTarget
      ? projects.find((candidate) => candidate.workspacePath === activeTarget.cwd)
      : undefined;
    const project = activeSessionProject || persistedCurrentProject || currentWorkspaceProject;
    const agentIds = Object.keys(getConfiguredAgentConfigs(this.preferenceService));
    const latestRequestAgentId = sessionModel?.requests?.at(-1)?.message.agentId;
    const activeDraftAgentId = this.aiChatService.getActiveAgenticTaskAgentId(sessionModel?.sessionId);
    const preferredAgentId = [
      activeTarget?.agentId,
      latestRequestAgentId,
      activeDraftAgentId,
      getDefaultAgentType(this.preferenceService),
    ].find((agentId): agentId is string => !!agentId && agentIds.includes(agentId));

    return {
      project,
      preferredAgentId: preferredAgentId || agentIds[0],
      executionContext:
        activeSessionProject && activeSessionProject.workspacePath !== currentWorkspaceProject?.workspacePath
          ? activeSessionProject
          : undefined,
    };
  }

  async launchHeaderTask(agentId?: string): Promise<AgenticHeaderTaskLaunchResult> {
    if (!this.beginTaskLaunch()) {
      return { status: 'busy' };
    }

    try {
      const context = await this.resolveHeaderTaskLaunchContext();
      if (!context.project) {
        return { status: 'no-project' };
      }
      if (context.project.availability === 'unavailable') {
        return { status: 'project-unavailable' };
      }
      const resolvedAgentId = agentId || context.preferredAgentId;
      if (!resolvedAgentId) {
        return { status: 'no-agent' };
      }
      return (await this.performTaskLaunch(context.project, resolvedAgentId))
        ? { status: 'launched' }
        : { status: 'failed' };
    } catch {
      return { status: 'failed' };
    } finally {
      this.finishTaskLaunch();
    }
  }

  async restorePendingWork(): Promise<void> {
    // Agent Session selection and drafts are page-local. Legacy Task records
    // remain retained for compatibility but are not read or mutated here.
  }

  async refreshProjectAvailability(project: AgenticProjectRecord): Promise<void> {
    const availability = await this.readProjectAvailability(project);
    await this.registry.markProjectAvailability(project.id, availability);
  }

  private async ensureProjectAvailable(project: AgenticProjectRecord): Promise<boolean> {
    if (project.availability === 'unavailable') {
      return false;
    }

    const availability = await this.readProjectAvailability(project);
    if (availability !== project.availability) {
      await this.registry.markProjectAvailability(project.id, availability);
    }
    return availability === 'available';
  }

  private async readProjectAvailability(project: AgenticProjectRecord): Promise<'available' | 'unavailable'> {
    try {
      const stat = await this.fileService.getFileStat(project.workspaceUri, false);
      return stat ? 'available' : 'unavailable';
    } catch {
      return 'unavailable';
    }
  }

  private beginTaskLaunch(): boolean {
    if (this.taskLaunchPending) {
      return false;
    }
    this.taskLaunchPending = true;
    this.onDidChangeTaskLaunchPendingEmitter.fire(true);
    return true;
  }

  private finishTaskLaunch(): void {
    this.taskLaunchPending = false;
    this.onDidChangeTaskLaunchPendingEmitter.fire(false);
  }

  private currentWorkspaceUri(): string | undefined {
    const workspaceUri = this.workspaceService.workspace?.uri;
    return workspaceUri ? this.toFileUri(workspaceUri)?.toString() : undefined;
  }

  private currentWorkspaceProject(): AgenticProjectRecord | undefined {
    const workspaceUri = this.currentWorkspaceUri();
    if (!workspaceUri) {
      return undefined;
    }

    const uri = URI.parse(workspaceUri);
    return {
      id: workspaceUri,
      workspaceUri,
      workspacePath: uri.codeUri.fsPath,
      joinedAt: 0,
      availability: 'available',
    };
  }

  private toFileUri(value: string): URI | undefined {
    try {
      const uri = URI.parse(value);
      return uri.scheme === 'file' ? uri : undefined;
    } catch {
      return undefined;
    }
  }
}
