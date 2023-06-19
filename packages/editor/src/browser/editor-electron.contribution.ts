import { Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  IClientApp,
  ClientAppContribution,
  KeybindingContribution,
  KeybindingRegistry,
  EDITOR_COMMANDS,
  Domain,
  electronEnv,
} from '@opensumi/ide-core-browser';
import { isOSX, OnEvent, WithEventBus } from '@opensumi/ide-core-common';
import { IElectronMainUIService } from '@opensumi/ide-core-common/lib/electron';

import { WorkbenchEditorService, IDocPersistentCacheProvider } from '../common';

import { IEditorDocumentModelContentRegistry } from './doc-model/types';
import { ResourceDecorationChangeEvent } from './types';
import { WorkbenchEditorServiceImpl } from './workbench-editor.service';

@Domain(ClientAppContribution, KeybindingContribution)
export class EditorElectronContribution extends WithEventBus implements ClientAppContribution, KeybindingContribution {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired(IDocPersistentCacheProvider)
  private cacheProvider: IDocPersistentCacheProvider;

  @Autowired(IEditorDocumentModelContentRegistry)
  contentRegistry: IEditorDocumentModelContentRegistry;

  @Autowired(IElectronMainUIService)
  private readonly electronMainUIService: IElectronMainUIService;

  @OnEvent(ResourceDecorationChangeEvent)
  onResourceDecorationChangeEvent() {
    const hasDirty = this.workbenchEditorService.hasDirty();
    // setup macos native dirty indicator
    this.electronMainUIService.setDocumentEdited(electronEnv.currentWindowId, hasDirty ? true : false);
  }

  /**
   * Return true in order to prevent exit
   */
  async onWillStop(app: IClientApp) {
    if (await this.workbenchEditorService.closeAllOnlyConfirmOnce()) {
      return true;
    }

    if (!this.cacheProvider.isFlushed()) {
      return true;
    }

    return false;
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.NEXT.id,
      keybinding: 'ctrl+tab',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.PREVIOUS.id,
      keybinding: 'ctrl+shift+tab',
    });
    if (isOSX) {
      keybindings.registerKeybinding({
        command: EDITOR_COMMANDS.NEXT.id,
        keybinding: 'ctrlcmd+shift+]',
      });
      keybindings.registerKeybinding({
        command: EDITOR_COMMANDS.PREVIOUS.id,
        keybinding: 'ctrlcmd+shift+[',
      });
    }
  }
}
