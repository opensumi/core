// @ts-check
/**
 * @typedef {import('@yarnpkg/types').Yarn.Constraints.Workspace} Workspace
 * @typedef {import('@yarnpkg/types').Yarn.Constraints.Dependency} Dependency
 * @typedef {import('@yarnpkg/types').Yarn.Constraints.Context} Context
 */

/** @type {import('@yarnpkg/types')} */
const { defineConfig } = require('@yarnpkg/types');

/**
 * 这条规则将强制工作区必须依赖于与其他工作区所使用的相同版本的依赖项。
 *
 * @param {Context} context
 */
function enforceConsistentDependenciesAcrossTheProject({ Yarn }) {
  for (const dependency of Yarn.dependencies()) {
    if (dependency.type === 'peerDependencies') {
      continue;
    }

    for (const otherDependency of Yarn.dependencies({ ident: dependency.ident })) {
      if (otherDependency.type === 'peerDependencies') {
        continue;
      }

      dependency.update(otherDependency.range);
    }
  }
}

module.exports = defineConfig({
  constraints: async (ctx) => {
    enforceConsistentDependenciesAcrossTheProject(ctx);
  },
});
