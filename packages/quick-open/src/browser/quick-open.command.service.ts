import { Injectable, Autowired } from '@ali/common-di';
import { localize } from '@ali/ide-core-browser';
import { CommandRegistry, Command, CommandService } from '@ali/ide-core-common';
import { QuickOpenModel, QuickOpenItem, QuickOpenMode } from './quick-open.model';
import { KeybindingRegistry, Keybinding } from '@ali/ide-core-browser';
import { QuickOpenHandler } from './prefix-quick-open.service';

@Injectable()
export class QuickCommandModel implements QuickOpenModel {
  @Autowired(CommandRegistry)
  protected commandRegistry: CommandRegistry;

  @Autowired(CommandService)
  protected commandService: CommandService;

  @Autowired(KeybindingRegistry)
  protected keybindings: KeybindingRegistry;

  getItems(lookFor: string) {
    const items: QuickOpenItem[] = [];
    const commands = this.getValidCommands(this.commandRegistry.getCommands());

    for (const command of commands) {
      items.push(new CommandQuickOpenItem(command, this.commandService, this.keybindings));
    }
    return items;
  }

  protected getValidCommands(raw: Command[]): Command[] {
    return raw.filter((command) => command.label);
  }
}

@Injectable()
export class QuickCommandHandler implements QuickOpenHandler {
  default = true;
  prefix = '>';
  description = localize('quickopen.command.description');

  @Autowired()
  private quickCommandModel: QuickCommandModel;

  getModel(): QuickOpenModel {
    return this.quickCommandModel;
  }
  getOptions() {
    return {
      placeholder: localize('quickopen.command.placeholder'),
      fuzzyMatchLabel: true,
      fuzzySort: true,
    };
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
    // allow the quick open widget to close itself
    setTimeout(() => {
      const activeElement = window.document.activeElement as HTMLElement;
      // reset focus on the previously active element.
      activeElement.focus();
      this.commands.executeCommand(this.command.id);
    }, 50);
    return true;
  }
}
