import { RawContextKey } from '@ali/ide-monaco/lib/browser/monaco.context-key.service';

/**
 * Context Keys to use with keybindings for the Explorer and Open Editors view
 */
export const ExplorerFolderContext = new RawContextKey<boolean>('explorerResourceIsFolder', false);
