import { Autowired, Injectable } from '@opensumi/di';
import {
  ContributionProvider,
  Deferred,
  IStorage,
  STORAGE_NAMESPACE,
  StorageProvider,
  URI,
  localize,
} from '@opensumi/ide-core-browser';
import { IDialogService } from '@opensumi/ide-overlay';

import {
  AllowedExtensionsContribution,
  DEFAULT_ALLOWED_EXTENSION_IDS,
  IAllowedExtensionsContribution,
  WORKSPACE_TRUST_STORAGE_KEY,
  WorkspaceTrustState,
} from '../common';

/**
 * Workspace trust service
 * Manages trust state for workspace directories and controls restricted mode
 */
@Injectable()
export class WorkspaceTrustService {
  @Autowired(StorageProvider)
  private readonly storageProvider: StorageProvider;

  @Autowired(IDialogService)
  private readonly dialogService: IDialogService;

  @Autowired(AllowedExtensionsContribution)
  private readonly allowedExtensionsContributions: ContributionProvider<IAllowedExtensionsContribution>;

  private trustStorage: IStorage;
  private currentTrustState: WorkspaceTrustState = WorkspaceTrustState.Undecided;
  private trustDecidedDeferred = new Deferred<void>();
  private _workspacePath: string | undefined;

  /**
   * Initialize the trust service and load current workspace trust state
   */
  async initialize(workspacePath: string): Promise<void> {
    this._workspacePath = workspacePath;
    this.trustStorage = await this.storageProvider(STORAGE_NAMESPACE.GLOBAL_EXTENSIONS);
    await this.trustStorage.whenReady;

    const savedState = this.getTrustStateFromStorage(workspacePath);
    if (savedState) {
      this.currentTrustState = savedState;
      this.trustDecidedDeferred.resolve();
    }
  }

  /**
   * Get the trust state for a workspace path from storage
   */
  private getTrustStateFromStorage(workspacePath: string): WorkspaceTrustState | undefined {
    const key = `${WORKSPACE_TRUST_STORAGE_KEY}:${workspacePath}`;
    const value = this.trustStorage.get<string>(key);
    if (value === WorkspaceTrustState.Trusted || value === WorkspaceTrustState.Restricted) {
      return value as WorkspaceTrustState;
    }
    return undefined;
  }

  /**
   * Save trust state to storage
   */
  private async saveTrustState(workspacePath: string, state: WorkspaceTrustState): Promise<void> {
    const key = `${WORKSPACE_TRUST_STORAGE_KEY}:${workspacePath}`;
    await this.trustStorage.set(key, state);
  }

  /**
   * Set the trust state for the current workspace
   */
  async setTrustState(state: WorkspaceTrustState): Promise<void> {
    if (!this._workspacePath) {
      return;
    }
    this.currentTrustState = state;
    await this.saveTrustState(this._workspacePath, state);
    this.trustDecidedDeferred.resolve();
  }

  /**
   * Get current workspace trust state
   */
  getTrustState(): WorkspaceTrustState {
    return this.currentTrustState;
  }

  /**
   * Check if current workspace is in restricted mode
   */
  isRestricted(): boolean {
    return this.currentTrustState === WorkspaceTrustState.Restricted;
  }

  /**
   * Check if current workspace is trusted
   */
  isTrusted(): boolean {
    return this.currentTrustState === WorkspaceTrustState.Trusted;
  }

  /**
   * Get the promise that resolves when trust decision is made
   */
  whenTrustDecided(): Promise<void> {
    return this.trustDecidedDeferred.promise;
  }

  /**
   * Show trust dialog and wait for user decision
   */
  async showTrustDialog(): Promise<WorkspaceTrustState> {
    const result = await this.dialogService.open({
      message: `${localize('workspace.trust.dialog.title', '是否信任此文件夹中的文件的作者？')}\n\n${localize(
        'workspace.trust.dialog.message',
        '当前 IDE 提供可以自动在此文件夹中执行文件的功能。\n\n如果不信任这些文件的作者，则建议继续使用受限模式，因为这些文件可能是恶意文件。',
      )}`,
      type: 1, // MessageType.Info
      buttons: [
        localize('workspace.trust.dialog.button.trust', '是的，我信任他们'),
        localize('workspace.trust.dialog.button.restricted', '受限模式'),
      ],
      closable: false,
    });

    if (result === localize('workspace.trust.dialog.button.trust', 'Yes, I trust the authors')) {
      await this.setTrustState(WorkspaceTrustState.Trusted);
      return WorkspaceTrustState.Trusted;
    } else {
      await this.setTrustState(WorkspaceTrustState.Restricted);
      return WorkspaceTrustState.Restricted;
    }
  }

  /**
   * Ensure trust decision is made - shows dialog if not yet decided
   */
  async ensureTrustDecided(): Promise<void> {
    if (this.currentTrustState === WorkspaceTrustState.Undecided) {
      await this.showTrustDialog();
    }
  }

  /**
   * Get allowed extension IDs in restricted mode (base + contributions)
   */
  getAllowedExtensionIds(): string[] {
    const allIds = new Set(DEFAULT_ALLOWED_EXTENSION_IDS);
    const contributions = this.allowedExtensionsContributions.getContributions();
    for (const c of contributions) {
      for (const id of c.getAllowedExtensionIds()) {
        allIds.add(id);
      }
    }
    return Array.from(allIds);
  }

  /**
   * Filter extension metadata to only include allowed extensions in restricted mode
   */
  filterExtensions<T extends { id: string }>(extensions: T[]): T[] {
    if (!this.isRestricted()) {
      return extensions;
    }
    const allowedIds = new Set(this.getAllowedExtensionIds());
    return extensions.filter((ext) => allowedIds.has(ext.id));
  }
}
