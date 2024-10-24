import { LibroSearchToggleCommand, LibroService, LibroView, NotebookCommands } from '@difizen/libro-jupyter/noeditor';
import { Container, CommandRegistry as LibroCommandRegistry } from '@difizen/mana-app';

import { Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  CommandRegistry,
  Domain,
  IContextKeyService,
  KeybindingRegistry,
  KeybindingScope,
} from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';

import { LIBRO_COMPONENTS_SCHEME_ID } from './libro.protocol';
import { ManaContainer } from './mana';

@Domain(ClientAppContribution)
export class LibroKeybindContribition implements ClientAppContribution {
  @Autowired(IContextKeyService) contextKeyService: IContextKeyService;
  @Autowired(KeybindingRegistry) keybindingRegistry: KeybindingRegistry;
  @Autowired(WorkbenchEditorService)
  workbenchEditorService: WorkbenchEditorService;
  @Autowired(CommandRegistry)
  protected readonly commandRegistry: CommandRegistry;
  @Autowired(ManaContainer)
  private readonly manaContainer: Container;

  onStart() {
    this.registerContextKey();
    this.registerCommand();
    this.registerKeybind();
  }

  registerContextKey() {
    const notebookFocusContext = this.contextKeyService.createKey<boolean>(
      'libroNotebookFocused',
      this.hasActiveNotebook(),
    );

    this.workbenchEditorService.onActiveResourceChange((e) => {
      if (e?.uri?.path.ext === `.${LIBRO_COMPONENTS_SCHEME_ID}`) {
        notebookFocusContext.set(true);
      } else {
        notebookFocusContext.set(false);
      }
    });
  }

  get libroService() {
    return this.manaContainer.get(LibroService);
  }

  get libroCommandRegistry() {
    return this.manaContainer.get(LibroCommandRegistry);
  }

  hasActiveNotebook() {
    return this.libroService.active instanceof LibroView;
  }

  registerCommand() {
    this.commandRegistry.registerCommand(NotebookCommands['EnterCommandMode'], {
      execute: () => {
        this.libroCommandRegistry.executeCommand(NotebookCommands['EnterCommandMode'].id);
      },
    });
    this.commandRegistry.registerCommand(NotebookCommands['RunCell'], {
      execute: () => {
        this.libroCommandRegistry.executeCommand(NotebookCommands['RunCell'].id);
      },
    });
    this.commandRegistry.registerCommand(NotebookCommands['RunCellAndSelectNext'], {
      execute: () => {
        this.libroCommandRegistry.executeCommand(NotebookCommands['RunCellAndSelectNext'].id);
      },
    });
    this.commandRegistry.registerCommand(NotebookCommands['RunCellAndInsertBelow'], {
      execute: () => {
        this.libroCommandRegistry.executeCommand(NotebookCommands['RunCellAndInsertBelow'].id);
      },
    });
    this.commandRegistry.registerCommand(NotebookCommands['SplitCellAntCursor'], {
      execute: () => {
        this.libroCommandRegistry.executeCommand(NotebookCommands['SplitCellAntCursor'].id);
      },
    });
    this.commandRegistry.registerCommand(LibroSearchToggleCommand.ShowLibroSearch, {
      execute: () => {
        this.libroCommandRegistry.executeCommand(LibroSearchToggleCommand.ShowLibroSearch.id);
      },
    });
  }

  registerKeybind() {
    this.keybindingRegistry.registerKeybindings(
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
