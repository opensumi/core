import { RawContextKey } from '../raw-context-key';

/**
 * Context Keys to use with keybindings for the Workspace
 */
export const WorkbenchState = new RawContextKey<string>('workbenchState', 'empty');
export const WorkspaceFolderCount = new RawContextKey<number>('workspaceFolderCount', 0);
export const WorkspaceTrusted = new RawContextKey<boolean>('isWorkspaceTrusted', true);
export const VirtualWorkspace = new RawContextKey<boolean>('virtualWorkspace', false);
