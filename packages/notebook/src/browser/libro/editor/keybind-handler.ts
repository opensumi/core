import { LibroSearchToggleCommand, LibroService, LibroView, NotebookCommands } from '@difizen/libro-jupyter/noeditor';
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
  @inject(LibroService) protected readonly libroService: LibroService;

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
    return this.libroService.active instanceof LibroView;
  }

  private registerSingleCommand(command: { id: string }) {
    const sumiCommandRegistry: SumiCommandRegistry = this.injector.get(SumiCommandRegistry);
    sumiCommandRegistry.registerCommand(command, {
      execute: () => {
        this.commandRegistry.executeCommand(command.id);
      },
    });
  }

  registerCommand() {
    const commands = [
      NotebookCommands['EnterCommandMode'],
      NotebookCommands['RunCell'],
      NotebookCommands['RunCellAndSelectNext'],
      NotebookCommands['RunCellAndInsertBelow'],
      NotebookCommands['SplitCellAntCursor'],
      LibroSearchToggleCommand.ShowLibroSearch,
    ];
    
    commands.forEach(command => this.registerSingleCommand(command));
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
