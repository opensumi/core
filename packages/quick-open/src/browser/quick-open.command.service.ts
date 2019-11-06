import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { localize } from '@ali/ide-core-browser';
import { CommandRegistry, Command, CommandService } from '@ali/ide-core-common';
import { QuickOpenModel, QuickOpenItem, QuickOpenMode, QuickOpenGroupItemOptions, QuickOpenGroupItem } from './quick-open.model';
import { KeybindingRegistry, Keybinding } from '@ali/ide-core-browser';
import { QuickOpenHandler } from './prefix-quick-open.service';
import { IWorkspaceService } from '@ali/ide-workspace';
import { CorePreferences } from '@ali/ide-core-browser/lib/core-preferences';

@Injectable()
export class QuickCommandModel implements QuickOpenModel {

  @Autowired(INJECTOR_TOKEN)
  protected injector: Injector;

  @Autowired(CommandRegistry)
  protected commandRegistry: CommandRegistry;

  @Autowired(IWorkspaceService)
  protected workspaceService: IWorkspaceService;

  @Autowired(CorePreferences)
  protected readonly corePreferences: CorePreferences;

  constructor() {
    this.init();
  }

  async init() {
    const recentCommands = await this.workspaceService.recentCommands();
    this.commandRegistry.setRecentCommands(recentCommands);
  }

  onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void) {
    acceptor(this.getItems(lookFor));
  }

  getItems(lookFor: string) {
    const items: QuickOpenItem[] = [];
    const { recent, other } = this.getCommands();

    items.push(
      // 渲染最近使用命令
      ...recent.map((command, index) =>
      this.injector.get(CommandQuickOpenItem, [command, {
        groupLabel: index === 0 ? localize('quickopen.recent-commands') : '',
        showBorder: false,
      }])),
      // 渲染其他命令
      ...other.map((command, index) =>
      this.injector.get(CommandQuickOpenItem, [command, {
        groupLabel: recent.length <= 0 ? '' : index === 0 ? localize('quickopen.other-commands') : '',
        showBorder: recent.length <= 0 ? false : index === 0 ? true : false,
      }])),
    );
    return items;
  }

  protected getCommands(): { recent: Command[], other: Command[] } {
    const allCommands = this.getValidCommands(this.commandRegistry.getCommands());
    const recentCommands = this.getValidCommands(this.commandRegistry.getRecentCommands());
    const limit = this.corePreferences['workbench.commandPalette.history'];
    return {
      recent: recentCommands.slice(0, limit),
      other: allCommands
        // 过滤掉最近使用中含有的命令
        .filter((command) => !recentCommands.some((recent) => recent.id === command.id))
        // 命令重新排序
        .sort((a, b) => Command.compareCommands(a, b)),
    };
  }

  /**
   * 筛选 command 是否可用
   * 1. 判断标签是否存在
   * 2. 判断是否可见
   * 3. 判断是否可用
   * @param commands 要校验的 command
   */
  protected getValidCommands(commands: Command[]): Command[] {
    return commands.filter((command) => command.label
      && this.commandRegistry.isVisible(command.id)
      && this.commandRegistry.isEnabled(command.id));
  }
}

@Injectable()
export class QuickCommandHandler implements QuickOpenHandler {
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
      fuzzyMatchLabel: {
        enableSeparateSubstringMatching: true,
      },
      fuzzyMatchDetail: {
        enableSeparateSubstringMatching: true,
      },
      // 关闭模糊排序，否则会按照 label 长度排序
      // 按照 CommandRegistry 默认排序
      fuzzySort: false,
    };
  }
}

@Injectable({ multiple: true })
export class CommandQuickOpenItem extends QuickOpenGroupItem {

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired(KeybindingRegistry)
  keybindings: KeybindingRegistry;

  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;

  constructor(
    protected readonly command: Command,
    protected readonly commandOptions?: QuickOpenGroupItemOptions,
  ) {
    super(commandOptions);
  }

  getLabel(): string {
    return (this.command.category)
      ? `${this.command.category}: ` + this.command.label!
      : this.command.label!;
  }

  isHidden(): boolean {
    return super.isHidden();
  }

  getDetail(): string | undefined {
    return this.command.label !== this.command.alias ? this.command.alias : undefined;
  }

  getKeybinding(): Keybinding | undefined {
    const bindings = this.keybindings.getKeybindingsForCommand(this.command.id);
    return bindings ? bindings[0] : undefined;
  }

  run(mode: QuickOpenMode): boolean {
    if (mode !== QuickOpenMode.OPEN) {
      return false;
    }
    setTimeout(() => {
      this.commandService.executeCommand(this.command.id);
      // 执行的同时写入Workspace存储文件中
      this.workspaceService.setRecentCommand(this.command);
    }, 50);
    return true;
  }
}
