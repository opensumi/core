import { RawContextKey } from '../raw-context-key';

/**
 * Context Keys to use with keybindings for the Explorer and Open Editors view
 */
export const ExplorerFolderContext = new RawContextKey<boolean>('explorerResourceIsFolder', false);
