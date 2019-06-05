import { Injectable, Autowired } from '@ali/common-di';
import { KeybindingContext } from '@ali/ide-core-browser';

// tslint:disable-next-line:no-namespace
export namespace FileTreeKeybindingContexts {
    /**
     * ID of a keybinding context that is enabled when the file-tree item has the focus.
     */
    export const fileTreeItemFocus = 'fileTreeItemFocus';
}

@Injectable()
export class FileTreeContentContext implements KeybindingContext {

    readonly id: string = FileTreeKeybindingContexts.fileTreeItemFocus;

    isEnabled(): boolean {
       console.log('FileTree is enabled.');
       return true;
    }
}
