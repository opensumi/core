import { LibroSearchToggleCommand, LibroService, NotebookCommands } from '@difizen/libro-jupyter/noeditor';
import { Container, CommandRegistry as LibroCommandRegistry } from '@difizen/mana-app';

import { Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  CommandContribution,
  CommandRegistry,
  Domain,
  IContextKeyService,
  KeybindingContribution,
  KeybindingRegistry,
  KeybindingScope,
  MaybePromise,
} from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';

import { LIBRO_COMPONENTS_SCHEME_ID } from './libro.protocol';
import { ManaContainer } from './mana';

@Domain(ClientAppContribution, KeybindingContribution, CommandContribution)
export class LibroKeybindContribution implements ClientAppContribution, KeybindingContribution, CommandContribution {
  @Autowired(IContextKeyService) contextKeyService: IContextKeyService;
  @Autowired(WorkbenchEditorService)
  workbenchEditorService: WorkbenchEditorService;
  @Autowired(CommandRegistry)
  protected readonly commandRegistry: CommandRegistry;
  @Autowired(ManaContainer)
  private readonly manaContainer: Container;

  initialize(): MaybePromise<void> {
    this.registerContextKey();
  }

  registerContextKey() {
    const notebookFocusContext = this.contextKeyService.createKey<boolean>('libroNotebookFocused', false);

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

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(NotebookCommands['EnterCommandMode'], {
      execute: () => {
        this.libroCommandRegistry.executeCommand(NotebookCommands['EnterCommandMode'].id);
      },
    });
    commands.registerCommand(NotebookCommands['RunCell'], {
      execute: () => {
        this.libroCommandRegistry.executeCommand(NotebookCommands['RunCell'].id);
      },
    });
    commands.registerCommand(NotebookCommands['RunCellAndSelectNext'], {
      execute: () => {
        this.libroCommandRegistry.executeCommand(NotebookCommands['RunCellAndSelectNext'].id);
      },
    });
    commands.registerCommand(NotebookCommands['RunCellAndInsertBelow'], {
      execute: () => {
        this.libroCommandRegistry.executeCommand(NotebookCommands['RunCellAndInsertBelow'].id);
      },
    });
    commands.registerCommand(NotebookCommands['SplitCellAntCursor'], {
      execute: () => {
        this.libroCommandRegistry.executeCommand(NotebookCommands['SplitCellAntCursor'].id);
      },
    });
    commands.registerCommand(LibroSearchToggleCommand.ShowLibroSearch, {
      execute: () => {
        this.libroCommandRegistry.executeCommand(LibroSearchToggleCommand.ShowLibroSearch.id);
      },
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybindings(
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
          when: 'libroNotebookFocused && !editorHasSelection && !editorHasMultipleSelections',
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
