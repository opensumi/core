// 锁定插件版本到 vscode v1.37.1
// https://github.com/microsoft/vscode/releases/tag/1.37.1
export const vscAuthority = 'kt-ext://cdn.jsdelivr.net/gh/microsoft/vscode/extensions';

export const wrapDomain = (config) => {
  const uriPrefix = vscAuthority + config.extPath + '/';
  return {
    ...config,
    pkgJSON: {
      ...config.pkgJSON,
      contributes: {
        ...config.pkgJSON.contributes,
        languages: config.pkgJSON.contributes.languages.map((l) => {
          if ('configuration' in l) {
            return {
              ...l,
              configuration: uriPrefix + l.configuration,
            };
          }
          return l;
        }),
        grammars: config.pkgJSON.contributes.grammars.map((g) => {
          if ('path' in g) {
            return {
              ...g,
              path: uriPrefix + g.path,
            };
          }
          return g;
        }),
      },
    },
  };
};
