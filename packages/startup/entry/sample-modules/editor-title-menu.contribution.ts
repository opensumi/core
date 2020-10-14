// tslint:disable:no-console
import { Autowired } from '@ali/common-di';
import { Disposable, IEventBus } from '@ali/ide-core-common';
import { ClientAppContribution, IContextKey, IContextKeyService, CommandRegistry, CommandContribution, Domain, getIcon } from '@ali/ide-core-browser';
import { NextMenuContribution, IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { EditorGroupChangeEvent } from '@ali/ide-editor/lib/browser';

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
export class EditorTitleMenuContribution extends Disposable implements CommandContribution, NextMenuContribution, ClientAppContribution {
  @Autowired(IContextKeyService)
  private readonly globalCtxKeyService: IContextKeyService;

  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

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

  registerNextMenus(menus: IMenuRegistry): void {
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
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(WebSCMCommands.Edit, {
      execute: async (...args) => {
        console.log(args, 'args');
      },
    });

    commands.registerCommand(WebSCMCommands.Save, {
      execute: async (...args) => {
        console.log(args, 'args');
        this.toggledCtxKey.set(!this.toggledCtxKey.get());
      },
    });
  }
}
