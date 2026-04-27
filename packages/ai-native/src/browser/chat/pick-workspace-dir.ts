import { QuickPickService } from '@opensumi/ide-core-browser';
import { URI, formatLocalize, localize } from '@opensumi/ide-core-common';
import { IMessageService } from '@opensumi/ide-overlay';
import { IWorkspaceService } from '@opensumi/ide-workspace';

let cachedWorkspaceDir: string | null = null;

/**
 * Resolve the workspace directory for ACP operations.
 * In multi-root workspace mode, prompts the user to select a workspace root via QuickPick on first call,
 * then returns the cached result on subsequent calls.
 * In single workspace mode, returns the workspace root directly.
 */
export async function pickWorkspaceDir(
  workspaceService: IWorkspaceService,
  quickPick: QuickPickService,
  messageService: IMessageService,
): Promise<string> {
  if (cachedWorkspaceDir !== null) {
    return cachedWorkspaceDir;
  }

  const dir = await doPickWorkspaceDir(workspaceService, quickPick, messageService);
  cachedWorkspaceDir = dir;
  return dir;
}

/**
 * Force re-pick the workspace directory (clears cache and shows QuickPick).
 * Called from the UI button to switch workspace path.
 */
export async function switchWorkspaceDir(
  workspaceService: IWorkspaceService,
  quickPick: QuickPickService,
  messageService: IMessageService,
): Promise<string> {
  cachedWorkspaceDir = null;
  const dir = await doPickWorkspaceDir(workspaceService, quickPick, messageService);
  cachedWorkspaceDir = dir;
  return dir;
}

/**
 * Get the current cached workspace directory, or empty string if not yet selected.
 */
export function getCachedWorkspaceDir(): string {
  return cachedWorkspaceDir ?? '';
}

async function doPickWorkspaceDir(
  workspaceService: IWorkspaceService,
  quickPick: QuickPickService,
  messageService: IMessageService,
): Promise<string> {
  await workspaceService.whenReady;

  if (workspaceService.isMultiRootWorkspaceOpened) {
    const roots = workspaceService.tryGetRoots();
    const choose = await quickPick.show(
      roots.map((file) => new URI(file.uri).codeUri.fsPath),
      { placeholder: localize('chat.selectCWDForACP') },
    );
    if (choose) {
      return choose;
    }
    // User cancelled: fall back to first root and notify
    const fallback = new URI(roots[0].uri).codeUri.fsPath;
    messageService.info(formatLocalize('chat.defaultCWDSelected', fallback));
    return fallback;
  }

  if (workspaceService.workspace) {
    return new URI(workspaceService.workspace.uri).codeUri.fsPath;
  }

  return '';
}
