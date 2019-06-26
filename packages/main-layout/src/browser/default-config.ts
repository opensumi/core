export const defaultConfig = {
  modules: [
    '@ali/ide-main-layout',
    '@ali/ide-menu-bar',
    '@ali/ide-monaco',
    '@ali/ide-doc-model',
    '@ali/ide-status-bar',
    '@ali/ide-editor',
    '@ali/ide-explorer',
    '@ali/ide-file-tree',
    '@ali/ide-terminal',
    '@ali/ide-activator-bar',
    '@ali/ide-activator-panel',
    '@ali/ide-file-service',
    '@ali/ide-static-resource',
    '@ali/ide-express-file-server',
    '@ali/ide-language',
    // '@ali/ide-git',
    '@ali/ide-bottom-panel',
    '@ali/ide-search',
    '@ali/ide-file-scheme',
    '@ali/ide-output',
  ],
  layoutConfig: {
    top: {
      modules: ['@ali/ide-menu-bar'],
    },
    left: {
      modules: ['@ali/ide-explorer', '@ali/ide-search'],
    },
    right: {
      modules: [],
    },
    main: {
      modules: ['@ali/ide-editor'],
    },
    bottom: {
      modules: ['@ali/ide-terminal', '@ali/ide-output'],
    },
    bottomBar: {
      modules: ['@ali/ide-status-bar'],
    },
  },
};

export const defaultFrontEndDependencies = [
  '@ali/ide-main-layout/lib/browser',
  '@ali/ide-menu-bar/lib/browser',
  '@ali/ide-monaco/lib/browser',
  '@ali/ide-doc-model/lib/browser',
  '@ali/ide-status-bar/lib/browser',
  '@ali/ide-editor/lib/browser',
  '@ali/ide-explorer/lib/browser',
  '@ali/ide-terminal/lib/browser',
  '@ali/ide-activator-bar/lib/browser',
  '@ali/ide-activator-panel/lib/browser',
  '@ali/ide-file-service/lib/browser',
  '@ali/ide-static-resource/lib/browser',
  '@ali/ide-express-file-server/lib/browser',
  '@ali/ide-language/lib/browser',
  '@ali/ide-git/lib/browser',
  '@ali/ide-bottom-panel/lib/browser',
  '@ali/ide-search/lib/browser',
  '@ali/ide-file-scheme/lib/browser',
  '@ali/ide-output/lib/browser',
];
