import { mergeContributes } from '../../src/node/merge-contributes';

describe('mergeContributes', () => {
  const command1 = {
    command: 'test.cmd1',
    title: 'test.cmd1',
    category: 'git',
  };

  const command2 = {
    command: 'test.cmd2',
    title: 'test.cmd2',
    category: 'git',
  };

  const menu1 = {
    command: 'menu1',
    when: 'when1',
    group: 'navigation',
  };

  const menu2 = {
    command: 'menu2',
    when: 'when2',
    group: 'navigation',
  };

  const config1 = {
    'git.enabled': {
      type: 'boolean',
      scope: 'resource',
      description: '%config.enabled%',
      default: true,
    },
  };

  const config2 = {
    'git.autoRepositoryDetection': {
      type: ['boolean', 'string'],
      enum: [true, false, 'subFolders', 'openEditors'],
      enumDescriptions: [
        '%config.autoRepositoryDetection.true%',
        '%config.autoRepositoryDetection.false%',
        '%config.autoRepositoryDetection.subFolders%',
        '%config.autoRepositoryDetection.openEditors%',
      ],
      description: '%config.autoRepositoryDetection%',
      default: true,
    },
  };

  const config3 = {
    'git.autorefresh': {
      type: 'boolean',
      description: '%config.autorefresh%',
      default: true,
    },
  };

  const view1 = {
    id: 'gitlens',
    name: 'GitLens',
    when: 'config.gitlens.views.fileHistory.enabled',
  };
  const view2 = {
    id: 'gitlens1',
    name: 'GitLens1',
    when: '!config.gitlens.views.fileHistory.enabled',
  };

  const viewsContainer1 = {
    id: 'gitlens',
    title: 'GitLens',
    icon: 'images/gitlens-activitybar.svg',
  };
  const viewsContainer2 = {
    id: 'gitlens1',
    title: 'GitLens1',
    icon: 'images/gitlens-activitybar1.svg',
  };

  const grammar1 = {
    language: 'json',
    scopeName: 'source.json',
    path: './syntaxes/JSON.tmLanguage.json',
  };

  const grammar2 = {
    language: 'jsonc',
    scopeName: 'source.json.comments',
    path: './syntaxes/JSONC.tmLanguage.json',
  };

  const snippet1 = {
    language: 'c',
    path: './snippets/c.code-snippets',
  };

  const snippet2 = {
    language: 'cpp',
    path: './snippets/cpp.code-snippets',
  };

  const color1 = {
    id: 'gitlens.gutterBackgroundColor',
    description: 'Specifies the background color of the gutter blame annotations',
    defaults: {
      dark: '#FFFFFF13',
      light: '#0000000C',
      highContrast: '#FFFFFF13',
      highContrastLight: '#FFFFFF13',
    },
  };

  const color2 = {
    id: 'gitlens.gutterForegroundColor',
    description: 'Specifies the foreground color of the gutter blame annotations',
    defaults: {
      dark: '#BEBEBE',
      light: '#747474',
      highContrast: '#BEBEBE',
      highContrastLight: '#BEBEBE',
    },
  };

  const keybinding1 = {
    command: 'gitlens.key.left',
    key: 'left',
    when: 'gitlens:key:left',
  };

  const keybinding2 = {
    command: 'gitlens.key.right',
    key: 'right',
    when: 'gitlens:key:right',
  };

  it('ok for commands', () => {
    expect(mergeContributes({ commands: [command1] }, { commands: [command2] })).toEqual({
      commands: [command2, command1],
    });

    expect(mergeContributes({ commands: [command1] }, undefined)).toEqual({
      commands: [command1],
    });

    expect(mergeContributes(undefined, { commands: [command2] })).toEqual({
      commands: [command2],
    });

    expect(mergeContributes({ commands: [] }, { commands: [command2] })).toEqual({
      commands: [command2],
    });
  });

  it('ok for menus', () => {
    expect(
      mergeContributes(
        {
          menus: { commandPalette: [menu1] },
        },
        {
          menus: { commandPalette: [menu2] },
        },
      ),
    ).toEqual({
      menus: {
        commandPalette: [menu2, menu1],
      },
    });

    expect(
      mergeContributes(
        {
          menus: { commandPalette: [menu1] },
        },
        {
          menus: { 'explorer/title': [menu2] },
        },
      ),
    ).toEqual({
      menus: {
        commandPalette: [menu1],
        'explorer/title': [menu2],
      },
    });

    expect(mergeContributes(undefined, { menus: { commandPalette: [menu2] } })).toEqual({
      menus: {
        commandPalette: [menu2],
      },
    });

    expect(mergeContributes({}, { menus: { commandPalette: [menu2] } })).toEqual({
      menus: {
        commandPalette: [menu2],
      },
    });

    expect(mergeContributes({ menus: { commandPalette: [menu1] } }, { menus: {} })).toEqual({
      menus: {
        commandPalette: [menu1],
      },
    });

    expect(mergeContributes({ menus: { commandPalette: [menu1] } }, { menus: {} })).toEqual({
      menus: {
        commandPalette: [menu1],
      },
    });
  });

  it('ok for configuration', () => {
    expect(
      mergeContributes(
        {
          configuration: {
            title: 'Git',
            properties: config1,
          },
        },
        {
          configuration: {
            title: 'Git',
            properties: config2,
          },
        },
      ),
    ).toEqual({
      configuration: [
        {
          title: 'Git',
          properties: config2,
        },
        {
          title: 'Git',
          properties: config1,
        },
      ],
    });

    expect(
      mergeContributes(
        {
          configuration: [
            {
              title: 'Git',
              properties: config1,
            },
            {
              title: 'Git1',
              properties: config3,
            },
          ],
        },
        {
          configuration: {
            title: 'Git',
            properties: config2,
          },
        },
      ),
    ).toEqual({
      configuration: [
        {
          title: 'Git',
          properties: config2,
        },
        {
          title: 'Git',
          properties: config1,
        },
        {
          title: 'Git1',
          properties: config3,
        },
      ],
    });
  });

  it('ok for viewsContainers', () => {
    expect(
      mergeContributes(
        {
          viewsContainers: {
            activitybar: [viewsContainer1],
          },
        },
        {
          viewsContainers: {
            activitybar: [viewsContainer2],
          },
        },
      ),
    ).toEqual({
      viewsContainers: {
        activitybar: [viewsContainer2, viewsContainer1],
      },
    });

    expect(
      mergeContributes(undefined, {
        viewsContainers: {
          activitybar: [viewsContainer2],
        },
      }),
    ).toEqual({
      viewsContainers: {
        activitybar: [viewsContainer2],
      },
    });

    expect(
      mergeContributes(
        {
          viewsContainers: {
            activitybar: [viewsContainer2],
          },
        },
        {},
      ),
    ).toEqual({
      viewsContainers: {
        activitybar: [viewsContainer2],
      },
    });

    expect(
      mergeContributes(
        {
          viewsContainers: {
            activitybar: [viewsContainer2],
          },
        },
        { viewsContainers: {} },
      ),
    ).toEqual({
      viewsContainers: {
        activitybar: [viewsContainer2],
      },
    });

    expect(
      mergeContributes(
        {
          viewsContainers: {
            activitybar: [],
          },
        },
        {
          viewsContainers: {
            activitybar: [viewsContainer2],
          },
        },
      ),
    ).toEqual({
      viewsContainers: {
        activitybar: [viewsContainer2],
      },
    });
  });

  it('ok for views', () => {
    expect(
      mergeContributes(
        {
          views: {
            explorer: [view1],
          },
        },
        {
          views: {
            gitlens: [view1],
            explorer: [view2],
          },
        },
      ),
    ).toEqual({
      views: {
        explorer: [view2, view1],
        gitlens: [view1],
      },
    });

    expect(
      mergeContributes(undefined, {
        views: {
          gitlens: [view1],
          explorer: [view2],
        },
      }),
    ).toEqual({
      views: {
        gitlens: [view1],
        explorer: [view2],
      },
    });

    expect(
      mergeContributes(
        {
          views: {
            explorer: [view1],
          },
        },
        {
          views: {
            gitlens: [],
            explorer: [],
          },
        },
      ),
    ).toEqual({
      views: {
        explorer: [view1],
        gitlens: [],
      },
    });

    expect(
      mergeContributes(
        {
          views: {
            explorer: [view1],
          },
        },
        { views: {} },
      ),
    ).toEqual({
      views: {
        explorer: [view1],
      },
    });
  });

  it('ok for keybinding', () => {
    expect(mergeContributes({ keybindings: [keybinding1] }, { keybindings: [keybinding2] })).toEqual({
      keybindings: [keybinding2, keybinding1],
    });

    expect(mergeContributes({ keybindings: [keybinding1] }, undefined)).toEqual({
      keybindings: [keybinding1],
    });

    expect(mergeContributes({ keybindings: [keybinding1] }, { keybindings: [] })).toEqual({
      keybindings: [keybinding1],
    });
  });

  it('ok for colors', () => {
    expect(mergeContributes({ colors: [color1] }, { colors: [color2] })).toEqual({
      colors: [color2, color1],
    });

    expect(mergeContributes({ colors: [color1] }, undefined)).toEqual({
      colors: [color1],
    });

    expect(mergeContributes({ colors: [] }, { colors: [color2] })).toEqual({
      colors: [color2],
    });
  });

  it('ok for snippets', () => {
    expect(mergeContributes({ snippets: [snippet1] }, { snippets: [snippet2] })).toEqual({
      snippets: [snippet2, snippet1],
    });

    expect(mergeContributes({ snippets: [snippet1] }, undefined)).toEqual({
      snippets: [snippet1],
    });

    expect(mergeContributes({ snippets: [] }, { snippets: [snippet2] })).toEqual({
      snippets: [snippet2],
    });
  });

  it('ok for grammars', () => {
    expect(mergeContributes({ grammars: [grammar1] }, { grammars: [grammar2] })).toEqual({
      grammars: [grammar2, grammar1],
    });

    expect(mergeContributes({ grammars: [grammar1] }, undefined)).toEqual({
      grammars: [grammar1],
    });

    expect(mergeContributes({ grammars: [] }, { grammars: [grammar2] })).toEqual({
      grammars: [grammar2],
    });
  });

  it('ok for complex contributes', () => {
    expect(
      mergeContributes(
        {
          grammars: [grammar1],
          commands: [],
          menus: {
            commandPalette: [menu1],
          },
          viewsContainers: {
            activitybar: [viewsContainer1],
          },
          views: {
            explorer: [view1],
          },
          snippets: [snippet1, snippet2],
          configuration: [
            {
              title: 'Git',
              properties: config2,
            },
            {
              title: 'Git',
              properties: config3,
            },
          ],
        },
        {
          grammars: [grammar2],
          commands: [command1, command2],
          menus: {
            commandPalette: [menu2],
            'explorer/title': [menu1, menu2],
          },
          viewsContainers: {
            activitybar: [viewsContainer2],
          },
          views: {
            explorer: [],
          },
          keybindings: [keybinding2],
          configuration: {
            title: 'Git',
            properties: config2,
          },
        },
      ),
    ).toEqual({
      grammars: [grammar2, grammar1],
      commands: [command1, command2],
      menus: {
        commandPalette: [menu2, menu1],
        'explorer/title': [menu1, menu2],
      },
      viewsContainers: {
        activitybar: [viewsContainer2, viewsContainer1],
      },
      views: {
        explorer: [view1],
      },
      snippets: [snippet1, snippet2],
      keybindings: [keybinding2],
      configuration: [
        {
          title: 'Git',
          properties: config2,
        },
        {
          title: 'Git',
          properties: config2,
        },
        {
          title: 'Git',
          properties: config3,
        },
      ],
    });
  });
});
