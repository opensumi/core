import { LibroSearchToggleCommand, NotebookCommands } from '@difizen/libro-jupyter';
import { ApplicationContribution, CommandRegistry, inject, singleton } from '@difizen/mana-app';

import { Injector } from '@opensumi/di';
import {
  IContextKeyService,
  KeybindingRegistry,
  KeybindingScope,
  CommandRegistry as SumiCommandRegistry,
} from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';

import { LIBRO_COMPONENTS_SCHEME_ID } from '../../libro.protocol';
import { OpensumiInjector } from '../../mana/index';

@singleton({ contrib: ApplicationContribution })
export class Keybindhandler implements ApplicationContribution {
  @inject(OpensumiInjector) injector: Injector;
  @inject(CommandRegistry) protected readonly commandRegistry: CommandRegistry;
  // @inject(LibroService) protected readonly libroService: LibroService;

  onStart() {
    this.registerContextKey();
    this.registerCommand();
    this.registerKeybind();
  }

  registerContextKey() {
    const contextKeyService: IContextKeyService = this.injector.get(IContextKeyService);
    const workbenchEditorService: WorkbenchEditorService = this.injector.get(WorkbenchEditorService);
    const notebookFocusContext = contextKeyService.createKey<boolean>('libroNotebookFocused', this.hasActiveNotebook());

    workbenchEditorService.onActiveResourceChange((e) => {
      if (e?.uri?.path.ext === `.${LIBRO_COMPONENTS_SCHEME_ID}`) {
        notebookFocusContext.set(true);
      } else {
        notebookFocusContext.set(false);
      }
    });
  }

  hasActiveNotebook() {
    return false;
    // return this.libroService.active instanceof LibroView;
  }

  registerCommand() {
    const sumiCommandRegistry: SumiCommandRegistry = this.injector.get(SumiCommandRegistry);
    sumiCommandRegistry.registerCommand(NotebookCommands['EnterCommandMode'], {
      execute: () => {
        this.commandRegistry.executeCommand(NotebookCommands['EnterCommandMode'].id);
      },
    });
    sumiCommandRegistry.registerCommand(NotebookCommands['RunCell'], {
      execute: () => {
        this.commandRegistry.executeCommand(NotebookCommands['RunCell'].id);
      },
    });
    sumiCommandRegistry.registerCommand(NotebookCommands['RunCellAndSelectNext'], {
      execute: () => {
        this.commandRegistry.executeCommand(NotebookCommands['RunCellAndSelectNext'].id);
      },
    });
    sumiCommandRegistry.registerCommand(NotebookCommands['RunCellAndInsertBelow'], {
      execute: () => {
        this.commandRegistry.executeCommand(NotebookCommands['RunCellAndInsertBelow'].id);
      },
    });
    sumiCommandRegistry.registerCommand(NotebookCommands['SplitCellAntCursor'], {
      execute: () => {
        this.commandRegistry.executeCommand(NotebookCommands['SplitCellAntCursor'].id);
      },
    });
    sumiCommandRegistry.registerCommand(LibroSearchToggleCommand.ShowLibroSearch, {
      execute: () => {
        this.commandRegistry.executeCommand(LibroSearchToggleCommand.ShowLibroSearch.id);
      },
    });
  }

  registerKeybind() {
    const keybindingService: KeybindingRegistry = this.injector.get(KeybindingRegistry);
    keybindingService.registerKeybindings(
      [
        {
          keybinding: 'f1',
          command: '',
          when: 'libroNotebookFocused',
        },
        {
          keybinding: 'f8',
          command: '',
          when: 'libroNotebookFocused',
        },
        {
          keybinding: 'f9',
          command: '',
          when: 'libroNotebookFocused',
        },
        {
          keybinding: 'esc',
          command: NotebookCommands['EnterCommandMode'].id,
          when: 'libroNotebookFocused && !editorHasSelection && !editorHasSelection && !editorHasMultipleSelections',
        },
        {
          keybinding: 'ctrlcmd+enter',
          command: NotebookCommands['RunCell'].id,
          when: 'libroNotebookFocused && !findWidgetVisible && !referenceSearchVisible',
        },
        {
          keybinding: 'shift+enter',
          command: NotebookCommands['RunCellAndSelectNext'].id,
          when: 'libroNotebookFocused && !findInputFocussed',
        },
        {
          keybinding: 'alt+enter',
          command: NotebookCommands['RunCellAndInsertBelow'].id,
          when: 'libroNotebookFocused && !findWidgetVisible',
        },
        {
          keybinding: 'ctrlcmd+shift+-',
          command: NotebookCommands['SplitCellAntCursor'].id,
          when: 'libroNotebookFocused && !findWidgetVisible',
        },
        {
          keybinding: 'ctrlcmd+f',
          command: LibroSearchToggleCommand.ShowLibroSearch.id,
          when: 'libroNotebookFocused',
        },
      ],
      KeybindingScope.USER,
    );
  }
}
