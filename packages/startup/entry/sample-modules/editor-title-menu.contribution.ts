// eslint-disable-next-line no-console
import { Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  IContextKey,
  IContextKeyService,
  CommandRegistry,
  CommandContribution,
  Domain,
  getIcon,
} from '@opensumi/ide-core-browser';
import { NextMenuContribution, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { Disposable, IEventBus } from '@opensumi/ide-core-common';
import { EditorGroupChangeEvent } from '@opensumi/ide-editor/lib/browser';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

class WebSCMCommands {
  static Edit = {
    id: 'web-scm.edit',
  };

  static Save = {
    id: 'web-scm.save',
  };
}

const toggledCtx = 'test.ctx.toggled';

@Domain(CommandContribution, NextMenuContribution, ClientAppContribution)
export class EditorTitleMenuContribution
  extends Disposable
  implements CommandContribution, NextMenuContribution, ClientAppContribution
{
  @Autowired(IContextKeyService)
  private readonly globalCtxKeyService: IContextKeyService;

  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

  @Autowired(IMainLayoutService)
  private readonly mainLayoutService: IMainLayoutService;

  private toggledCtxKey: IContextKey<boolean>;
  constructor() {
    super();
    this.toggledCtxKey = this.globalCtxKeyService.createKey<boolean>(toggledCtx, false);
  }

  onStart() {
    this.addDispose(
      // 编辑器切换时更新高亮的 contextkey
      this.eventBus.on(EditorGroupChangeEvent, (e) => {
        const { newResource } = e.payload;
        if (!newResource || !newResource.uri) {
          return;
        }
        this.toggledCtxKey.set(newResource.uri.path.toString().endsWith('ts'));
      }),
    );
  }

  registerMenus(menus: IMenuRegistry): void {
    menus.registerMenuItem(MenuId.EditorTitle, {
      command: {
        id: WebSCMCommands.Edit.id,
        label: '打开',
      },
      iconClass: getIcon('open'),
      group: 'navigation',
    });

    menus.registerMenuItem(MenuId.EditorTitle, {
      command: {
        id: WebSCMCommands.Save.id,
        label: '保存',
      },
      iconClass: getIcon('save-all'),
      group: 'navigation',
      toggledWhen: toggledCtx,
    });

    menus.registerMenuItem(MenuId.EditorTitle, {
      command: {
        id: 'command.test.toggle.explorer',
        label: '展开文件树',
      },
      iconClass: getIcon('start'),
      group: 'navigation',
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(WebSCMCommands.Edit, {
      execute: async (...args) => {
        // eslint-disable-next-line no-console
        console.log(args, 'args');
      },
    });

    commands.registerCommand(WebSCMCommands.Save, {
      execute: async (...args) => {
        // eslint-disable-next-line no-console
        console.log(args, 'args');
        this.toggledCtxKey.set(!this.toggledCtxKey.get());
      },
    });

    commands.registerCommand(
      {
        id: 'command.test.toggle.explorer',
      },
      {
        execute: async (...args) => {
          const explorerRef = this.mainLayoutService.getTabbarHandler('explorer');
          if (explorerRef) {
            explorerRef.setCollapsed('file-explorer-next', !explorerRef.isCollapsed('file-explorer-next'));
          }
        },
      },
    );
  }
}
