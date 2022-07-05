import { IJSONSchema, localize } from "@opensumi/ide-core-common";
import { MenuId } from "../../menu/next";

interface IAPIMenu {
  readonly id: MenuId;
  readonly description: string;
}

const menuItem: IJSONSchema = {
  type: 'object',
  required: ['command'],
  defaultSnippets: [
    {
      body: {
        command: '${1}'
      }
    }
  ],
  properties: {
    command: {
      description: localize('kaitianContributes.common.command'),
      type: 'string'
    },
    when: {
      description: localize('kaitianContributes.common.when'),
      type: 'string'
    },
    group: {
      description: localize('kaitianContributes.common.group'),
      type: 'string'
    }
  }
};

const submenu: IJSONSchema = {
  type: 'object',
  required: ['id', 'title'],
  properties: {
    id: {
      description: localize('kaitianContributes.submenus.id'),
      type: 'string'
    },
    title: {
      description: localize('kaitianContributes.submenus.title'),
      type: 'string'
    },
    group: {
      description: localize('kaitianContributes.common.group'),
      type: 'string'
    },
    when: {
      type: 'string',
      description: localize('kaitianContributes.common.when'),
    },
    icon: {
      description: localize('kaitianContributes.submenus.icon'),
      anyOf: [{
        type: 'string'
      },
      {
        type: 'object',
        properties: {
          light: {
            description: localize('kaitianContributes.submenus.icon.light'),
            type: 'string'
          },
          dark: {
            description: localize('kaitianContributes.submenus.dark'),
            type: 'string'
          }
        }
      }]
    }
  }
};

const apiMenus: IAPIMenu[] = [
  {
    id: MenuId.CommandPalette,
    description: localize('kaitianContributes.menu.api.CommandPalette'),
  },
  {
    id: MenuId.ActivityBarExtra,
    description: localize('kaitianContributes.menu.api.ActivityBarExtra'),
  },
  {
    id: MenuId.DebugBreakpointsContext,
    description: localize('kaitianContributes.menu.api.DebugBreakpointsContext'),
  },
  {
    id: MenuId.DebugCallStackContext,
    description: localize('kaitianContributes.menu.api.DebugCallStackContext'),
  },
  {
    id: MenuId.DebugConsoleContext,
    description: localize('kaitianContributes.menu.api.DebugConsoleContext'),
  },
  {
    id: MenuId.DebugVariablesContext,
    description: localize('kaitianContributes.menu.api.DebugVariablesContext'),
  },
  {
    id: MenuId.DebugWatchContext,
    description: localize('kaitianContributes.menu.api.DebugWatchContext'),
  },
  {
    id: MenuId.DebugToolBar,
    description: localize('kaitianContributes.menu.api.DebugToolBar'),
  },
  {
    id: MenuId.EditorContext,
    description: localize('kaitianContributes.menu.api.EditorContext'),
  },
  {
    id: MenuId.EditorTitle,
    description: localize('kaitianContributes.menu.api.EditorTitle'),
  },
  {
    id: MenuId.EditorTitleContext,
    description: localize('kaitianContributes.menu.api.EditorTitleContext'),
  },
  {
    id: MenuId.ExplorerContext,
    description: localize('kaitianContributes.menu.api.ExplorerContext'),
  },
  {
    id: MenuId.MenubarAppMenu,
    description: localize('kaitianContributes.menu.api.MenubarAppMenu'),
  },
  {
    id: MenuId.MenubarEditMenu,
    description: localize('kaitianContributes.menu.api.MenubarEditMenu'),
  },
  {
    id: MenuId.MenubarFileMenu,
    description: localize('kaitianContributes.menu.api.MenubarFileMenu'),
  },
  {
    id: MenuId.MenubarGoMenu,
    description: localize('kaitianContributes.menu.api.MenubarGoMenu'),
  },
  {
    id: MenuId.MenubarHelpMenu,
    description: localize('kaitianContributes.menu.api.MenubarHelpMenu'),
  },
  {
    id: MenuId.MenubarViewMenu,
    description: localize('kaitianContributes.menu.api.MenubarViewMenu'),
  },
  {
    id: MenuId.MenubarSelectionMenu,
    description: localize('kaitianContributes.menu.api.MenubarSelectionMenu'),
  },
  {
    id: MenuId.MenubarTerminalMenu,
    description: localize('kaitianContributes.menu.api.MenubarTerminalMenu'),
  },
  {
    id: MenuId.TerminalInstanceContext,
    description: localize('kaitianContributes.menu.api.TerminalInstanceContext'),
  },
  {
    id: MenuId.TerminalNewDropdownContext,
    description: localize('kaitianContributes.menu.api.TerminalNewDropdownContext'),
  },
  {
    id: MenuId.TerminalTabContext,
    description: localize('kaitianContributes.menu.api.TerminalTabContext'),
  },
  {
    id: MenuId.OpenEditorsContext,
    description: localize('kaitianContributes.menu.api.OpenEditorsContext'),
  },
  {
    id: MenuId.SCMResourceContext,
    description: localize('kaitianContributes.menu.api.SCMResourceContext'),
  },
  {
    id: MenuId.SCMResourceGroupContext,
    description: localize('kaitianContributes.menu.api.SCMResourceGroupContext'),
  },
  {
    id: MenuId.SCMResourceFolderContext,
    description: localize('kaitianContributes.menu.api.SCMResourceFolderContext'),
  },
  {
    id: MenuId.SCMTitle,
    description: localize('kaitianContributes.menu.api.SCMTitle'),
  },
  {
    id: MenuId.SCMInput,
    description: localize('kaitianContributes.menu.api.SCMInput'),
  },
  {
    id: MenuId.SearchContext,
    description: localize('kaitianContributes.menu.api.SearchContext'),
  },
  {
    id: MenuId.StatusBarContext,
    description: localize('kaitianContributes.menu.api.StatusBarContext'),
  },
  {
    id: MenuId.ViewItemContext,
    description: localize('kaitianContributes.menu.api.ViewItemContext'),
  },
  {
    id: MenuId.ViewTitle,
    description: localize('kaitianContributes.menu.api.ViewTitle'),
  },
  {
    id: MenuId.SettingsIconMenu,
    description: localize('kaitianContributes.menu.api.SettingsIconMenu'),
  }
];

const index = <T, R>(array: ReadonlyArray<T>, indexer: (t: T) => string, mapper?: (t: T) => R): { [key: string]: R } => {
  return array.reduce((r, t) => {
    r[indexer(t)] = mapper ? mapper(t) : t;
    return r;
  }, Object.create(null));
}


export namespace menus {
  export const schema: IJSONSchema = {
    description: localize('kaitianContributes.menu'),
    type: 'object',
    properties: index(apiMenus, menu => menu.id, menu => ({
      type: 'array',
      description: menu.description,
      items: menuItem
    }))
  }

  export const subMenusSchema: IJSONSchema = {
    description: localize('kaitianContributes.submenus'),
    type: 'object',
    additionalProperties: submenu
  }
}
