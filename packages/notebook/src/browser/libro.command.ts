import { LibroSearchManager, LibroService } from '@difizen/libro-jupyter';
import { Container } from '@difizen/mana-app';

import { Autowired } from '@opensumi/di';
import { CommandContribution, CommandRegistry, Domain, EDITOR_COMMANDS } from '@opensumi/ide-core-browser';

import { ManaContainer } from './mana';

@Domain(CommandContribution)
export class LibroCommandContribution implements CommandContribution {
  @Autowired(ManaContainer)
  private readonly manaContainer: Container;

  registerCommands(commands: CommandRegistry): void {
    commands.registerHandler(EDITOR_COMMANDS.SAVE_CURRENT.id, {
      execute: () => {
        const libroService = this.manaContainer.get(LibroService);
        const libro = libroService.active;
        libro?.save();
      },
      isEnabled: () => {
        const libroService = this.manaContainer.get(LibroService);
        if (libroService.focus) {
          return true;
        }
        return false;
      },
    });
    commands.registerHandler(EDITOR_COMMANDS.FOCUS_IF_NOT_ACTIVATE_ELEMENT.id, {
      execute: () => {
        const libroService = this.manaContainer.get(LibroService);
        const libro = libroService.active;
        const libroSearchManager = this.manaContainer.get(LibroSearchManager);
        if (libro) {
          libroSearchManager.showSearchView(libro);
        }
      },
      isEnabled: () => {
        const libroService = this.manaContainer.get(LibroService);
        if (libroService.focus) {
          return true;
        }
        return false;
      },
    });
    commands.registerHandler('markers', {
      execute: () => {
        const libroService = this.manaContainer.get(LibroService);
        const libro = libroService.active;
        if (libro && libro.activeCell) {
          libro.mergeCellBelow(libro.activeCell);
        }
      },
      isEnabled: () => {
        const libroService = this.manaContainer.get(LibroService);
        if (libroService.focus) {
          return true;
        }
        return false;
      },
    });
  }
}
