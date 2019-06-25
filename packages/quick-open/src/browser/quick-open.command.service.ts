import { Injectable, Autowired } from '@ali/common-di';
import { CommandRegistry, Command, CommandService } from '@ali/ide-core-common';
import { QuickOpenModel, QuickOpenItem, QuickOpenMode } from './quick-open.model';
import { QuickOpenService } from './quick-open.service';
import { KeybindingRegistry, Keybinding } from '@ali/ide-core-browser';

@Injectable()
export class QuickCommandService implements QuickOpenModel {

  @Autowired(QuickOpenService)
  protected quickOpenService: QuickOpenService;

  @Autowired(CommandRegistry)
  protected commandRegistry: CommandRegistry;

  @Autowired(CommandService)
  protected commandService: CommandService;

  @Autowired(KeybindingRegistry)
  protected keybindings: KeybindingRegistry;

  open(): void {
    this.quickOpenService.open(this, {
        placeholder: 'Type the name of a command you want to execute',
        fuzzyMatchLabel: true,
        fuzzySort: true,
    });
}

  getItems(lookFor: string): QuickOpenItem[] {
    const items: QuickOpenItem[] = [];
    for (const command of this.commandRegistry.getCommands()) {
        if (command.label) {
            items.push(new CommandQuickOpenItem(command, this.commandService, this.keybindings));
        }
    }
    return items;
  }
}

export class CommandQuickOpenItem extends QuickOpenItem {
  constructor(
      protected readonly command: Command,
      protected readonly commands: CommandService,
      protected readonly keybindings: KeybindingRegistry,
  ) {
      super();
  }

  getLabel(): string {
      return this.command.label!;
  }

  isHidden(): boolean {
      return super.isHidden() || !this.commands.getActiveHandler(this.command.id);
  }

  getKeybinding(): Keybinding | undefined {
    const bindings = this.keybindings.getKeybindingsForCommand(this.command.id);
    return bindings ? bindings[0] : undefined;
 }

  run(mode: QuickOpenMode): boolean {
      if (mode !== QuickOpenMode.OPEN) {
          return false;
      }
      this.commands.executeCommand(this.command.id);
      return true;
  }
}
