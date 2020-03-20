import { RawContextKey } from '../raw-context-key';

/**
 * Context Keys to use with keybindings for the Explorer and Open Editors view
 */
export const ExplorerFolderContext = new RawContextKey<boolean>('explorerResourceIsFolder', false);

export const ExplorerResourceCut = new RawContextKey<boolean>('explorerResourceCut', false);
export const FilesExplorerFocusedContext = new RawContextKey<boolean>('filesExplorerFocus', false);
export const ExplorerFocusedContext = new RawContextKey<boolean>('explorerViewletFocus', false);
export const ExplorerFilteredContext = new RawContextKey<boolean>('explorerViewletFilter', false);
export const ExplorerCurrentContextUriContextKey = new RawContextKey<string>('filetreeContextUri', '');
export const ExplorerCurrentRelativeUriContextKey = new RawContextKey<boolean>('filetreeContextRelativeUri', '');
