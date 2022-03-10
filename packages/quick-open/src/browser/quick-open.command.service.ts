import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { localize, IContextKeyService, EDITOR_COMMANDS } from '@opensumi/ide-core-browser';
import { KeybindingRegistry, Keybinding } from '@opensumi/ide-core-browser';
import { CorePreferences } from '@opensumi/ide-core-browser/lib/core-preferences';
import { AbstractMenuService, MenuId, MenuItemNode } from '@opensumi/ide-core-browser/lib/menu/next';
import { QuickOpenModel, QuickOpenItem, QuickOpenItemOptions, Mode } from '@opensumi/ide-core-browser/lib/quick-open';
import {
  CommandRegistry,
  Command,
  CommandService,
  Deferred,
  IReporterService,
  REPORT_NAME,
} from '@opensumi/ide-core-common';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { QuickOpenHandler } from './prefix-quick-open.service';

@Injectable()
export class QuickCommandHandler implements QuickOpenHandler {
  prefix = '>';
  description = localize('quickopen.command.description');

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(INJECTOR_TOKEN)
  protected injector: Injector;

  @Autowired(CommandRegistry)
  protected commandRegistry: CommandRegistry;

  @Autowired(IWorkspaceService)
  protected workspaceService: IWorkspaceService;

  @Autowired(CorePreferences)
  protected readonly corePreferences: CorePreferences;

  @Autowired(AbstractMenuService)
  protected menuService: AbstractMenuService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(IReporterService)
  reporterService: IReporterService;

  private initDeferred = new Deferred<void>();

  private items: QuickOpenItem[];

  constructor() {
    // 提前加载工作空间里最近命令的数据
    this.initRecentlyUsedCommands();
  }

  // 每次打开命令面板后会触发一次
  async init() {
    await this.initDeferred.promise;
    this.items = this.getItems();
  }

  private async initRecentlyUsedCommands() {
    const recentCommandIds = await this.workspaceService.getMostRecentlyUsedCommands();
    const recentCommands: Command[] = recentCommandIds
      .map((commandId) => this.commandRegistry.getCommand(commandId))
      .filter((command) => !!command)
      .reverse() as Command[];
    this.commandRegistry.setRecentCommands(recentCommands);
    this.initDeferred.resolve();
  }

  getModel(): QuickOpenModel {
    return {
      onType: (lookFor: string, acceptor: (items: QuickOpenItem[]) => void) => {
        acceptor(this.items);
        this.reporterService.point(REPORT_NAME.QUICK_OPEN_MEASURE, 'command', {
          lookFor,
        });
      },
    };
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
      getPlaceholderItem: () =>
        new QuickOpenItem({
          label: localize('quickopen.commands.notfound'),
          run: () => false,
        }),
    };
  }

  onClose() {
    this.commandService.executeCommand(EDITOR_COMMANDS.FOCUS.id);
  }

  private getItems() {
    const items: QuickOpenItem[] = [];
    const { recent, other } = this.getCommands();

    items.push(
      // 渲染最近使用命令
      ...recent.map((command, index) =>
        this.injector.get(CommandQuickOpenItem, [
          command,
          {
            groupLabel: index === 0 ? localize('quickopen.recent-commands') : '',
            showBorder: false,
          },
        ]),
      ),
      // 渲染其他命令
      ...other.map((command, index) =>
        this.injector.get(CommandQuickOpenItem, [
          command,
          {
            groupLabel: recent.length <= 0 ? '' : index === 0 ? localize('quickopen.other-commands') : '',
            showBorder: recent.length <= 0 ? false : index === 0 ? true : false,
          },
        ]),
      ),
    );

    return items;
  }

  protected getOtherCommands() {
    const menus = this.menuService.createMenu(MenuId.CommandPalette, this.contextKeyService);
    const menuNodes = menus
      .getMenuNodes()
      .reduce((r, [, actions]) => [...r, ...actions], [] as MenuItemNode[])
      .filter((item) => item instanceof MenuItemNode && !item.disabled)
      .filter((item, index, array) => array.findIndex((n) => n.id === item.id) === index) as MenuItemNode[];
    menus.dispose();

    return menuNodes.reduce((prev, item) => {
      const command = this.commandRegistry.getCommand(item.id);
      // 过滤掉可能存在的 command "没有注册" 的情况
      if (command) {
        // 使用 Menu 中存在的 label
        prev.push({
          ...command,
          label: item.label,
        });
      }
      return prev;
    }, [] as Command[]);
  }

  protected getCommands(): { recent: Command[]; other: Command[] } {
    const otherCommands = this.getOtherCommands();
    const recentCommands = this.getValidCommands(this.commandRegistry.getRecentCommands());
    const limit = this.corePreferences['workbench.commandPalette.history'];
    return {
      recent: recentCommands.slice(0, limit),
      other: otherCommands
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
    return commands.filter(
      (command) =>
        command.label && this.commandRegistry.isVisible(command.id) && this.commandRegistry.isEnabled(command.id),
    );
  }
}

@Injectable({ multiple: true })
export class CommandQuickOpenItem extends QuickOpenItem {
  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired(KeybindingRegistry)
  keybindings: KeybindingRegistry;

  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;

  constructor(protected readonly command: Command, protected readonly commandOptions: QuickOpenItemOptions) {
    super(commandOptions);
  }

  getLabel(): string {
    return this.command.category ? `${this.command.category}: ` + this.command.label! : this.command.label!;
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

  run(mode: Mode): boolean {
    if (mode !== Mode.OPEN) {
      return false;
    }
    setTimeout(() => {
      this.commandService.executeCommand(this.command.id);
      this.commandRegistry.setRecentCommands([this.command]);
      // 执行的同时写入Workspace存储文件中
      this.workspaceService.setMostRecentlyUsedCommand(this.command.id);
    }, 50);
    return true;
  }
}
