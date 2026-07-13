import { Autowired, Injectable } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IMessageService } from '@opensumi/ide-overlay';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IChatInternalService } from '../../common';
import { AcpChatInternalService } from '../chat/chat.internal.service.acp';

import { AgenticProjectRecord, AgenticTaskRecord, AgenticTaskRegistryService } from './agentic-task-registry.service';

const SAVE_AND_SWITCH = 'Save All and Switch';
const DISCARD_AND_SWITCH = 'Discard Changes and Switch';
const CANCEL_SWITCH = 'Cancel';

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

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  private pendingActivationGeneration = 0;
  private pendingLaunchGeneration = 0;

  async seedProjectCatalog(): Promise<void> {
    await this.workspaceService.whenReady;

    const currentWorkspace = this.workspaceService.workspace;
    if (currentWorkspace) {
      await this.registerWorkspaceUri(currentWorkspace.uri);
    }

    const recentWorkspaces = await this.workspaceService.getMostRecentlyUsedWorkspaces();
    for (const workspaceUri of recentWorkspaces) {
      const uri = this.toFileUri(workspaceUri);
      if (!uri) {
        continue;
      }

      try {
        const stat = await this.fileService.getFileStat(uri.toString(), false);
        if (stat) {
          await this.registerWorkspaceUri(stat.uri);
        }
      } catch {
        // An unavailable MRU entry is not a Project until it can be resolved by the file service.
      }
    }
  }

  async activateTask(task: AgenticTaskRecord): Promise<void> {
    const project = await this.registry.getProject(task.projectId);
    if (!project || project.availability === 'unavailable') {
      return;
    }

    if (project.workspaceUri === this.currentWorkspaceUri()) {
      await this.aiChatService.activateSession(task.sessionId);
      await this.registry.markUnread(task.sessionId, false);
      return;
    }

    if (!(await this.confirmDirtyEditors())) {
      return;
    }

    const generation = ++this.pendingActivationGeneration;
    this.registry.preparePendingActivation({ sessionId: task.sessionId });
    try {
      await this.workspaceService.open(URI.file(project.workspacePath), { preserveWindow: true });
    } catch (error) {
      if (generation === this.pendingActivationGeneration) {
        this.registry.consumePendingActivation();
      }
      throw error;
    }
  }

  async launchTask(project: AgenticProjectRecord, agentId: string): Promise<boolean> {
    const targetProject = await this.registry.getProject(project.id);
    if (!targetProject || targetProject.availability === 'unavailable') {
      return false;
    }

    if (targetProject.workspaceUri === this.currentWorkspaceUri()) {
      this.registry.preparePendingLaunch({ projectId: targetProject.id, agentId });
      this.aiChatService.enterAgenticTaskDraft({ agentId, cwd: targetProject.workspacePath });
      return true;
    }

    if (!(await this.confirmDirtyEditors())) {
      return false;
    }

    const generation = ++this.pendingLaunchGeneration;
    this.registry.preparePendingLaunch({ projectId: targetProject.id, agentId });
    try {
      await this.workspaceService.open(URI.file(targetProject.workspacePath), { preserveWindow: true });
    } catch (error) {
      if (generation === this.pendingLaunchGeneration) {
        this.registry.consumePendingLaunch();
      }
      throw error;
    }
    return true;
  }

  async restorePendingWork(): Promise<void> {
    const activation = this.registry.consumePendingActivation();
    if (activation) {
      await this.aiChatService.activateSession(activation.sessionId);
      await this.registry.markUnread(activation.sessionId, false);
      return;
    }

    const launch = this.registry.consumePendingLaunch();
    if (!launch) {
      return;
    }

    const project = await this.registry.getProject(launch.projectId);
    if (!project || project.availability === 'unavailable') {
      return;
    }

    this.aiChatService.enterAgenticTaskDraft({ agentId: launch.agentId, cwd: project.workspacePath });
  }

  async refreshProjectAvailability(project: AgenticProjectRecord): Promise<void> {
    try {
      const stat = await this.fileService.getFileStat(project.workspaceUri, false);
      await this.registry.markProjectAvailability(project.id, stat ? 'available' : 'unavailable');
    } catch {
      await this.registry.markProjectAvailability(project.id, 'unavailable');
    }
  }

  private async confirmDirtyEditors(): Promise<boolean> {
    if (!(await this.hasDirtyEditors())) {
      return true;
    }

    const choice = await this.messageService.warning('You have unsaved editor changes. Choose how to continue.', [
      SAVE_AND_SWITCH,
      DISCARD_AND_SWITCH,
      CANCEL_SWITCH,
    ]);
    if (choice === SAVE_AND_SWITCH) {
      await this.editorService.saveAll(true);
      return !(await this.hasDirtyEditors());
    }

    if (choice === DISCARD_AND_SWITCH) {
      await this.editorService.closeAll(undefined, true);
      return true;
    }

    return false;
  }

  private async hasDirtyEditors(): Promise<boolean> {
    const documents = await this.editorService.getAllOpenedDocuments();
    return documents.some((document) => document.dirty);
  }

  private async registerWorkspaceUri(workspaceUri: string): Promise<void> {
    const uri = this.toFileUri(workspaceUri);
    if (!uri) {
      return;
    }

    await this.registry.registerProject({
      workspaceUri: uri.toString(),
      workspacePath: uri.codeUri.fsPath,
      joinedAt: Date.now(),
      availability: 'available',
    });
  }

  private currentWorkspaceUri(): string | undefined {
    const workspaceUri = this.workspaceService.workspace?.uri;
    return workspaceUri ? this.toFileUri(workspaceUri)?.toString() : undefined;
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
