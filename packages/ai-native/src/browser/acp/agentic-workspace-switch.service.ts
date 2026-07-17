import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Emitter, URI } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IChatInternalService } from '../../common';
import { AcpChatInternalService } from '../chat/chat.internal.service.acp';
import { getConfiguredAgentConfigs, getDefaultAgentType } from '../chat/get-default-agent-type';

import { AgenticProjectRecord, AgenticTaskRecord, AgenticTaskRegistryService } from './agentic-task-registry.service';

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

  async activateTask(task: AgenticTaskRecord): Promise<boolean> {
    const actionGeneration = ++this.taskActionGeneration;
    const shouldApply = () => actionGeneration === this.taskActionGeneration;
    const project = await this.registry.getProject(task.projectId);
    if (!shouldApply() || !project) {
      return false;
    }

    const available = await this.ensureProjectAvailable(project);
    if (!shouldApply() || !available) {
      return false;
    }

    const activated = await this.aiChatService.activateAgenticTaskSession(task.sessionId, shouldApply);
    if (activated && shouldApply()) {
      await this.registry.markUnread(task.sessionId, false);
    }
    return activated && shouldApply();
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

    if (registeredProject) {
      await this.registry.rememberProjectAgent(targetProject.id, agentId);
      if (!shouldApply()) {
        return false;
      }
      this.registry.preparePendingLaunch({ projectId: targetProject.id, agentId });
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
    const activeTask = sessionModel?.sessionId ? await this.registry.getTask(sessionModel.sessionId) : undefined;
    const activeTaskProject = activeTask?.projectId ? await this.registry.getProject(activeTask.projectId) : undefined;
    const project = activeTaskProject || persistedCurrentProject || currentWorkspaceProject;
    const agentIds = Object.keys(getConfiguredAgentConfigs(this.preferenceService));
    const latestRequestAgentId = sessionModel?.requests?.at(-1)?.message.agentId;
    const activeDraftAgentId = this.aiChatService.getActiveAgenticTaskAgentId(sessionModel?.sessionId);
    const preferredAgentId = [
      project?.lastAgentId,
      activeTask?.agentId,
      latestRequestAgentId,
      activeDraftAgentId,
      getDefaultAgentType(this.preferenceService),
    ].find((agentId): agentId is string => !!agentId && agentIds.includes(agentId));

    return {
      project,
      preferredAgentId: preferredAgentId || agentIds[0],
      executionContext:
        activeTaskProject && activeTaskProject.workspacePath !== currentWorkspaceProject?.workspacePath
          ? activeTaskProject
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
    const actionGeneration = ++this.taskActionGeneration;
    const shouldApply = () => actionGeneration === this.taskActionGeneration;
    const activation = this.registry.consumePendingActivation();
    if (activation) {
      const activated = await this.aiChatService.activateAgenticTaskSession(activation.sessionId, shouldApply);
      if (activated && shouldApply()) {
        await this.registry.markUnread(activation.sessionId, false);
      }
      return;
    }

    const launch = this.registry.consumePendingLaunch();
    if (launch) {
      const project = await this.registry.getProject(launch.projectId);
      if (!shouldApply() || !project || project.availability === 'unavailable') {
        return;
      }

      this.aiChatService.enterAgenticTaskDraft({ agentId: launch.agentId, cwd: project.workspacePath });
      return;
    }

    const activeTask = this.registry.getRememberedActiveTaskSession();
    if (!activeTask) {
      return;
    }
    const activated = await this.aiChatService.activateAgenticTaskSession(activeTask.sessionId, shouldApply);
    if (activated && shouldApply()) {
      await this.registry.markUnread(activeTask.sessionId, false);
    }
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
