import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  EDITOR_COMMANDS,
  IContextKeyService,
  Keybinding,
  KeybindingRegistry,
  localize,
} from '@opensumi/ide-core-browser';
import { CorePreferences } from '@opensumi/ide-core-browser/lib/core-preferences';
import { AbstractMenuService, MenuId, MenuItemNode } from '@opensumi/ide-core-browser/lib/menu/next';
import { Mode, QuickOpenItem, QuickOpenItemOptions, QuickOpenModel } from '@opensumi/ide-core-browser/lib/quick-open';
import {
  Command,
  CommandRegistry,
  CommandService,
  Deferred,
  IReporterService,
  REPORT_NAME,
} from '@opensumi/ide-core-common';
import { uppercaseFirstLetter } from '@opensumi/ide-utils/lib/strings';
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

  protected getCommands(): { recent: Command[]; other: Command[] } {
    const menus = this.menuService.createMenu(MenuId.CommandPalette, this.contextKeyService);

    const _recentCommands = this.getValidCommands(this.commandRegistry.getRecentCommands());
    const limit = this.corePreferences['workbench.commandPalette.history'];
    const recentCommands = _recentCommands.slice(0, limit);
    const recentCommandIds = new Set<string>(recentCommands.map((command) => command.id));
    // 用来记录某个命令 id 已被保存。相同的命令 id 只保存第一次
    const availableCommandIds = new Set<string>();
    const nodes = [] as MenuItemNode[];
    const otherCommands = [] as Command[];

    for (const [, actions] of menus.getMenuNodes()) {
      for (const item of actions) {
        if (!(item instanceof MenuItemNode) || item.disabled || availableCommandIds.has(item.id)) {
          continue;
        }
        // 这里先添加进来
        availableCommandIds.add(item.id);
        // 与上一句判断不能交换位置，allCommandIds 代表了所有命令的 id，也包括 recent 的
        if (recentCommandIds.has(item.id)) {
          continue;
        }
        nodes.push(item);
        const command = this.commandRegistry.getCommand(item.id);

        // 过滤掉可能存在的 command "没有注册" 的情况
        if (command) {
          // 使用 Menu 中存在的 label
          otherCommands.push({
            ...command,
            label: item.label,
          });
        }
      }
    }

    // 过滤掉无效的命令，可能此时该命令还没有被激活（when 条件为 False）
    for (let index = recentCommands.length - 1; index >= 0; index--) {
      const element = recentCommands[index];
      if (!availableCommandIds.has(element.id)) {
        recentCommands.splice(index, 1);
      }
    }

    menus.dispose();

    return {
      recent: recentCommands,
      other: otherCommands
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
    return this.command.category
      ? `${uppercaseFirstLetter(this.command.category)}: ` + this.command.label!
      : this.command.label!;
  }

  isHidden(): boolean {
    return super.isHidden();
  }

  /**
   * We show the command label in default language in detail if the command is localized.
   */
  getDetail(): string | undefined {
    if (!this.command.labelLocalized) {
      return;
    }
    let detail: string | undefined;
    const { alias, localized } = this.command.labelLocalized;
    if (alias !== localized) {
      const category = this.command.categoryLocalized?.alias ?? this.command.category;
      if (category) {
        detail = `${uppercaseFirstLetter(category)}: ${alias}`;
      } else {
        detail = alias;
      }
    }

    return detail;
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
