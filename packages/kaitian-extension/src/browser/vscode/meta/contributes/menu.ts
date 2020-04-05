import { Injectable, Autowired } from '@ali/common-di';
import { CommandRegistry, CommandService, ILogger, formatLocalize, replaceLocalizePlaceholder, IContextKeyService, isUndefined, URI } from '@ali/ide-core-browser';
import { ToolbarRegistry } from '@ali/ide-core-browser/lib/layout';
import { IMenuRegistry, MenuId, IMenuItem } from '@ali/ide-core-browser/lib/menu/next';
import { IEditorActionRegistry } from '@ali/ide-editor/lib/browser';
import { IEditorGroup } from '@ali/ide-editor';

import { VSCodeContributePoint, Contributes } from '../../../../common';

// tslint:disable-next-line: no-empty-interface
export interface MenuActionFormat extends IMenuItem {}

export interface MenusSchema {
  [MenuPosition: string]: MenuActionFormat[];
}

export const contributedMenuUtils = {
  isProposedAPI: (menuId: MenuId): boolean => {
    switch (menuId) {
      case MenuId.StatusBarWindowIndicatorMenu:
      case MenuId.MenubarFileMenu:
        return true;
    }
    return false;
  },
  parseMenuId: (value: string): MenuId | undefined => {
    switch (value) {
      case 'commandPalette': return MenuId.CommandPalette;
      case 'touchBar': return MenuId.TouchBarContext;
      case 'editor/title': return MenuId.EditorTitle;
      case 'editor/context': return MenuId.EditorContext;
      case 'explorer/context': return MenuId.ExplorerContext;
      case 'editor/title/context': return MenuId.EditorTitleContext;
      case 'debug/callstack/context': return MenuId.DebugCallStackContext;
      case 'debug/toolbar': return MenuId.DebugToolBar;
      case 'debug/toolBar': return MenuId.DebugToolBar;
      case 'menuBar/file': return MenuId.MenubarFileMenu;
      case 'scm/title': return MenuId.SCMTitle;
      case 'scm/sourceControl': return MenuId.SCMSourceControl;
      case 'scm/resourceGroup/context': return MenuId.SCMResourceGroupContext;
      case 'scm/resourceState/context': return MenuId.SCMResourceContext;
      case 'scm/change/title': return MenuId.SCMChangeContext;
      case 'statusBar/windowIndicator': return MenuId.StatusBarWindowIndicatorMenu;
      case 'view/title': return MenuId.ViewTitle;
      case 'view/item/context': return MenuId.ViewItemContext;
      case 'comments/commentThread/title': return MenuId.CommentsCommentThreadTitle;
      case 'comments/commentThread/context': return MenuId.CommentsCommentThreadContext;
      case 'comments/comment/title': return MenuId.CommentsCommentTitle;
      case 'comments/comment/context': return MenuId.CommentsCommentContext;
    }
    return undefined;
  },
};

export function isValidMenuItems(menu: MenuActionFormat[], collector: Console): boolean {
  if (!Array.isArray(menu)) {
    collector.error(formatLocalize('requirearray'));
    return false;
  }

  for (const item of menu) {
    if (typeof item.command !== 'string') {
      collector.error(formatLocalize('requirestring', 'command'));
      return false;
    }
    if (item.alt && typeof item.alt !== 'string') {
      collector.error(formatLocalize('optstring', 'alt'));
      return false;
    }
    if (item.when && typeof item.when !== 'string') {
      collector.error(formatLocalize('optstring', 'when'));
      return false;
    }
    if (item.group && typeof item.group !== 'string') {
      collector.error(formatLocalize('optstring', 'group'));
      return false;
    }
  }

  return true;
}

@Injectable()
@Contributes('menus')
export class MenusContributionPoint extends VSCodeContributePoint<MenusSchema> {

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(IMenuRegistry)
  newMenuRegistry: IMenuRegistry;

  @Autowired()
  toolBarRegistry: ToolbarRegistry;

  @Autowired(IEditorActionRegistry)
  editorActionRegistry: IEditorActionRegistry;

  @Autowired(IContextKeyService)
  contextKeyService: IContextKeyService;

  protected createSyntheticCommandId(menu: MenuActionFormat, prefix: string): string {
    const command = menu.command;
    let id = prefix + command;
    let index = 0;
    while (this.commandRegistry.getCommand(id)) {
      id = prefix + command + ':' + index;
      index++;
    }
    return id;
  }

  contribute() {

    const collector = console;

    // menu registeration
    for (const menuPosition of Object.keys(this.json)) {
      const menuActions = this.json[menuPosition];
      if (!isValidMenuItems(menuActions, console)) {
        return;
      }

      const menuId = contributedMenuUtils.parseMenuId(menuPosition);
      if (isUndefined(menuId)) {
        collector.warn(formatLocalize('menuId.invalid', '`{0}` is not a valid menu identifier', menuPosition));
        return;
      }

      if (contributedMenuUtils.isProposedAPI(menuId)/* && !extension.description.enableProposedApi*/) {
        collector.error(formatLocalize('proposedAPI.invalid', menuId));
        return;
      }

      for (const item of menuActions) {
        const command = this.commandRegistry.getRawCommand(item.command);
        // alt 逻辑先不处理
        const alt = item.alt && this.commandRegistry.getRawCommand(item.alt);

        if (!command) {
          collector.error(formatLocalize('missing.command', item.command));
          continue;
        }
        if (item.alt && !alt) {
          collector.warn(formatLocalize('missing.altCommand', item.alt));
        }
        if (item.command === item.alt) {
          collector.info(formatLocalize('dupe.command'));
        }

        let group: string | undefined;
        let order: number | undefined;
        if (item.group) {
          const idx = item.group.lastIndexOf('@');
          if (idx > 0) {
            group = item.group.substr(0, idx);
            order = Number(item.group.substr(idx + 1)) || undefined;
          } else {
            group = item.group;
          }
        }

        if (menuId === MenuId.EditorTitle && command.iconClass) {
          this.addDispose(this.editorActionRegistry.registerEditorAction({
            title: replaceLocalizePlaceholder(command.label)!,
            onClick: (resource, group: IEditorGroup) => {
              if (group.currentEditor) {
                this.commandService.executeCommand(command.id, group.currentEditor.currentUri);
              } else {
                this.commandService.executeCommand(command.id, resource ? resource.uri : undefined);
              }
            },
            iconClass: command.iconClass,
            when: item.when,
          }));
        } else {
          let argsTransformer: ((...args: any[]) => any[]) | undefined;
          if (menuId === MenuId.EditorTitleContext) {
            argsTransformer = ({uri, group}: {uri: URI, group: IEditorGroup}) => {
              return [uri.codeUri];
            };
          }

          this.addDispose(this.newMenuRegistry.registerMenuItem(
            menuId,
            {
              command: item.command,
              alt,
              group,
              order,
              when: item.when,
              argsTransformer,
              // 以下为 kaitian 扩展部分
              type: item.type,
              toggledWhen: item.toggledWhen,
              enabledWhen: item.enabledWhen,
            } as IMenuItem,
          ));
        }
      }
    }
  }
}
