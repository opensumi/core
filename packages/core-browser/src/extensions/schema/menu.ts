import { IJSONSchema, localize } from '@opensumi/ide-core-common';

import { MenuId } from '../../menu/next';

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
        command: '${1}',
      },
    },
  ],
  properties: {
    command: {
      description: localize('sumiContributes.common.command'),
      type: 'string',
    },
    when: {
      description: localize('sumiContributes.common.when'),
      type: 'string',
    },
    group: {
      description: localize('sumiContributes.common.group'),
      type: 'string',
    },
  },
};

const submenu: IJSONSchema = {
  type: 'object',
  required: ['id', 'title'],
  properties: {
    id: {
      description: localize('sumiContributes.submenus.id'),
      type: 'string',
    },
    title: {
      description: localize('sumiContributes.submenus.title'),
      type: 'string',
    },
    group: {
      description: localize('sumiContributes.common.group'),
      type: 'string',
    },
    when: {
      type: 'string',
      description: localize('sumiContributes.common.when'),
    },
    icon: {
      description: localize('sumiContributes.submenus.icon'),
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'object',
          properties: {
            light: {
              description: localize('sumiContributes.submenus.icon.light'),
              type: 'string',
            },
            dark: {
              description: localize('sumiContributes.submenus.dark'),
              type: 'string',
            },
          },
        },
      ],
    },
  },
};

const apiMenus: IAPIMenu[] = [
  {
    id: MenuId.CommandPalette,
    description: localize('sumiContributes.menu.api.CommandPalette'),
  },
  {
    id: MenuId.ActivityBarExtra,
    description: localize('sumiContributes.menu.api.ActivityBarExtra'),
  },
  {
    id: MenuId.DebugBreakpointsContext,
    description: localize('sumiContributes.menu.api.DebugBreakpointsContext'),
  },
  {
    id: MenuId.DebugCallStackContext,
    description: localize('sumiContributes.menu.api.DebugCallStackContext'),
  },
  {
    id: MenuId.DebugConsoleContext,
    description: localize('sumiContributes.menu.api.DebugConsoleContext'),
  },
  {
    id: MenuId.DebugVariablesContext,
    description: localize('sumiContributes.menu.api.DebugVariablesContext'),
  },
  {
    id: MenuId.DebugWatchContext,
    description: localize('sumiContributes.menu.api.DebugWatchContext'),
  },
  {
    id: MenuId.DebugToolBar,
    description: localize('sumiContributes.menu.api.DebugToolBar'),
  },
  {
    id: MenuId.EditorContext,
    description: localize('sumiContributes.menu.api.EditorContext'),
  },
  {
    id: MenuId.EditorTitle,
    description: localize('sumiContributes.menu.api.EditorTitle'),
  },
  {
    id: MenuId.EditorTitleContext,
    description: localize('sumiContributes.menu.api.EditorTitleContext'),
  },
  {
    id: MenuId.ExplorerContext,
    description: localize('sumiContributes.menu.api.ExplorerContext'),
  },
  {
    id: MenuId.MenubarAppMenu,
    description: localize('sumiContributes.menu.api.MenubarAppMenu'),
  },
  {
    id: MenuId.MenubarEditMenu,
    description: localize('sumiContributes.menu.api.MenubarEditMenu'),
  },
  {
    id: MenuId.MenubarFileMenu,
    description: localize('sumiContributes.menu.api.MenubarFileMenu'),
  },
  {
    id: MenuId.MenubarGoMenu,
    description: localize('sumiContributes.menu.api.MenubarGoMenu'),
  },
  {
    id: MenuId.MenubarHelpMenu,
    description: localize('sumiContributes.menu.api.MenubarHelpMenu'),
  },
  {
    id: MenuId.MenubarViewMenu,
    description: localize('sumiContributes.menu.api.MenubarViewMenu'),
  },
  {
    id: MenuId.MenubarSelectionMenu,
    description: localize('sumiContributes.menu.api.MenubarSelectionMenu'),
  },
  {
    id: MenuId.MenubarTerminalMenu,
    description: localize('sumiContributes.menu.api.MenubarTerminalMenu'),
  },
  {
    id: MenuId.TerminalInstanceContext,
    description: localize('sumiContributes.menu.api.TerminalInstanceContext'),
  },
  {
    id: MenuId.TerminalNewDropdownContext,
    description: localize('sumiContributes.menu.api.TerminalNewDropdownContext'),
  },
  {
    id: MenuId.TerminalTabContext,
    description: localize('sumiContributes.menu.api.TerminalTabContext'),
  },
  {
    id: MenuId.OpenEditorsContext,
    description: localize('sumiContributes.menu.api.OpenEditorsContext'),
  },
  {
    id: MenuId.SCMResourceContext,
    description: localize('sumiContributes.menu.api.SCMResourceContext'),
  },
  {
    id: MenuId.SCMResourceGroupContext,
    description: localize('sumiContributes.menu.api.SCMResourceGroupContext'),
  },
  {
    id: MenuId.SCMResourceFolderContext,
    description: localize('sumiContributes.menu.api.SCMResourceFolderContext'),
  },
  {
    id: MenuId.SCMTitle,
    description: localize('sumiContributes.menu.api.SCMTitle'),
  },
  {
    id: MenuId.SCMInput,
    description: localize('sumiContributes.menu.api.SCMInput'),
  },
  {
    id: MenuId.SearchContext,
    description: localize('sumiContributes.menu.api.SearchContext'),
  },
  {
    id: MenuId.StatusBarContext,
    description: localize('sumiContributes.menu.api.StatusBarContext'),
  },
  {
    id: MenuId.ViewItemContext,
    description: localize('sumiContributes.menu.api.ViewItemContext'),
  },
  {
    id: MenuId.ViewTitle,
    description: localize('sumiContributes.menu.api.ViewTitle'),
  },
  {
    id: MenuId.SettingsIconMenu,
    description: localize('sumiContributes.menu.api.SettingsIconMenu'),
  },
];

const index = <T, R>(array: ReadonlyArray<T>, indexer: (t: T) => string, mapper?: (t: T) => R): { [key: string]: R } =>
  array.reduce((r, t) => {
    r[indexer(t)] = mapper ? mapper(t) : t;
    return r;
  }, Object.create(null));

export namespace menus {
  export const schema: IJSONSchema = {
    description: localize('sumiContributes.menu'),
    type: 'object',
    properties: index(
      apiMenus,
      (menu) => menu.id,
      (menu) => ({
        type: 'array',
        description: menu.description,
        items: menuItem,
      }),
    ),
  };

  export const subMenusSchema: IJSONSchema = {
    description: localize('sumiContributes.submenus'),
    type: 'object',
    additionalProperties: submenu,
  };
}
