import { Autowired, Injectable } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IChatInternalService } from '../../common';
import { AcpChatInternalService } from '../chat/chat.internal.service.acp';

import { AgenticProjectRecord, AgenticTaskRecord, AgenticTaskRegistryService } from './agentic-task-registry.service';

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

  private taskActionGeneration = 0;

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
    if (!launch) {
      return;
    }

    const project = await this.registry.getProject(launch.projectId);
    if (!shouldApply() || !project || project.availability === 'unavailable') {
      return;
    }

    this.aiChatService.enterAgenticTaskDraft({ agentId: launch.agentId, cwd: project.workspacePath });
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
