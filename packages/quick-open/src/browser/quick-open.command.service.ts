import { Injectable, Autowired } from '@ali/common-di';
import { CommandRegistry, Command, CommandService } from '@ali/ide-core-common';
import { QuickOpenModel, QuickOpenItem, QuickOpenMode, QuickOpenService } from './quick-open.model';
import { KeybindingRegistry, Keybinding, ContextKeyService } from '@ali/ide-core-browser';

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

  @Autowired(ContextKeyService)
  protected contextKeyService: ContextKeyService;

  protected readonly contexts = new Map<string, string[]>();

  open(): void {
    this.quickOpenService.open(this, {
      placeholder: 'Type the1 name of a command you want to execute',
      fuzzyMatchLabel: true,
      fuzzySort: true,
    });
  }

  getItems(lookFor: string): QuickOpenItem[] {
    const items: QuickOpenItem[] = [];
    const commands = this.getValidCommands(this.commandRegistry.getCommands());

    for (const command of commands) {
      items.push(new CommandQuickOpenItem(command, this.commandService, this.keybindings));
    }
    return items;
  }

  private getValidCommands(raw: Command[]): Command[] {
    return raw.filter((command) => command.label);
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
