import { Autowired } from '@opensumi/di';
import { getIcon } from '@opensumi/ide-core-browser';
import {
  IMenuRegistry,
  ISubmenuItem,
  MenuId,
  MenuContribution,
  IMenuItem,
  MenuCommandDesc,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { Command, CommandContribution, CommandRegistry, Disposable, localize } from '@opensumi/ide-core-common';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';

import { WorkbenchEditorService } from '../types';

import { IEditorOpenType } from './../../common/editor';
import { WorkbenchEditorServiceImpl } from './../workbench-editor.service';

const SUB_MENU_ID = 'editor/openType/submenu';

namespace OPEN_TYPE_COMMANDS {
  export const EDITOR_OPEN_TYPE: Command = {
    id: 'editor.opentype',
  };
}

@Domain(CommandContribution, MenuContribution)
export class OpenTypeMenuContribution extends Disposable implements CommandContribution, MenuContribution {
  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(OPEN_TYPE_COMMANDS.EDITOR_OPEN_TYPE, {
      execute: (id: string) => {
        if (id) {
          this.workbenchEditorService.currentEditorGroup.changeOpenType(id);
        }
      },
    });
  }

  constructor() {
    super();
    this.disposables.push(
      this.workbenchEditorService.onActiveResourceChange((e) => {
        const openTypes = this.workbenchEditorService.currentEditorGroup.availableOpenTypes;
        // 如果打开方式没有两个以上，则不需要展示
        const preMenu = this.menuRegistry
          .getMenuItems(SUB_MENU_ID)
          .map((e) => (e as IMenuItem).command as MenuCommandDesc);
        preMenu.forEach((c) => {
          this.menuRegistry.unregisterMenuItem(SUB_MENU_ID, c.id);
        });

        this.menuRegistry.unregisterMenuItem(MenuId.EditorTitle, SUB_MENU_ID);

        if (openTypes.length >= 2) {
          this.registerMenuItem(openTypes);
        }
      }),
    );
  }

  registerMenus(menuRegistry: IMenuRegistry) {}

  private registerMenuItem(openTypes: IEditorOpenType[]) {
    const openTypeMenus = {
      submenu: SUB_MENU_ID,
      label: localize('editor.openType'),
      group: 'navigation',
      order: Number.MIN_SAFE_INTEGER,
      iconClass: getIcon('setting'),
      type: 'default',
    } as ISubmenuItem;

    this.menuRegistry.registerMenuItem(MenuId.EditorTitle, openTypeMenus);

    openTypes.forEach((type) => {
      this.menuRegistry.registerMenuItem(SUB_MENU_ID, {
        command: {
          id: OPEN_TYPE_COMMANDS.EDITOR_OPEN_TYPE.id,
          label: type.title || type.componentId || type.type,
        },
        extraTailArgs: [type.componentId ?? type.type],
        group: 'navigation',
      });
    });
  }
}
