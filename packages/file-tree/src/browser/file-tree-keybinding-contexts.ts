import { Autowired } from '@ali/common-di';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { KeybindingContext } from '@ali/ide-core-browser';
import FileTreeService from './file-tree.service';

export namespace FileTreeKeybindingContexts {
  export const fileTreeItemFocus = 'fileTreeItemFocus';
}

@Domain(KeybindingContext)
export class FileTreeItemKeybindingContext implements KeybindingContext {
  @Autowired()
  fileTreeService: FileTreeService;

  readonly id: string = FileTreeKeybindingContexts.fileTreeItemFocus;

  isEnabled(): boolean {
    console.log('check if the filetree is focused');
    return this.isFileTreeItemFocus();
  }

  protected isFileTreeItemFocus(): boolean {
    return this.fileTreeService.isFocused;
  }
}
