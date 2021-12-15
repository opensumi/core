import { RawContextKey } from '../raw-context-key';

/**
 * Context Keys to use with keybindings for the Explorer and Open Editors view
 */
export const ExplorerResourceIsFolderContext = new RawContextKey<boolean>('explorerResourceIsFolder', false);
export const ExplorerViewletVisibleContext = new RawContextKey<boolean>('explorerViewletVisible', true);

export const ExplorerResourceCut = new RawContextKey<boolean>('explorerResourceCut', false);
export const ExplorerFocusedContext = new RawContextKey<boolean>('explorerViewletFocus', false);
export const ExplorerFilteredContext = new RawContextKey<boolean>('explorerViewletFilter', false);

export const FilesExplorerFocusedContext = new RawContextKey<boolean>('filesExplorerFocus', false);
export const FilesExplorerInputFocusedContext = new RawContextKey<boolean>('filesExplorerInputFocus', false);
export const FilesExplorerFilteredContext = new RawContextKey<boolean>('filesExplorerFilteredContext', false);

// compressed nodes
export const ExplorerCompressedFocusContext = new RawContextKey<boolean>('explorerViewletCompressedFocus', false);
export const ExplorerCompressedFirstFocusContext = new RawContextKey<boolean>(
  'explorerViewletCompressedFirstFocus',
  false,
);
export const ExplorerCompressedLastFocusContext = new RawContextKey<boolean>(
  'explorerViewletCompressedLastFocus',
  false,
);
