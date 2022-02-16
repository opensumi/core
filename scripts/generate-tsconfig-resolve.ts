import fse from 'fs-extra';
import path from 'path';
import _ from 'lodash';

const packagesPath = path.join(__dirname, '../packages');
const referenceDirPath = path.join(__dirname, '../configs/ts/references');
const configJsonPath = path.join(__dirname, '../configs/ts/tsconfig.resolve.json');
const buildJsonPath = path.join(__dirname, '../configs/ts/tsconfig.build.json');

async function generateResolve(sorted: Map<string, string>) {
  const paths = {};
  // "@opensumi/ide-core-common": ["../packages/core-common/src/index.ts"],
  // "@opensumi/ide-core-common/lib/*": ["../packages/core-common/src/*"],
  for (const [dir, pkgName] of sorted.entries()) {
    paths[pkgName] = ['../packages/' + dir + '/src/index.ts'];
    paths[pkgName + '/lib/*'] = ['../packages/' + dir + '/src/*'];
  }

  console.log(paths);

  const configJson = await fse.readJson(configJsonPath);
  configJson.compilerOptions.paths = paths;
  await fse.writeJson(configJsonPath, configJson, { spaces: 2 });
}

async function generateReferences(dirs: string[]) {
  const references = [] as string[];
  for await (const dir of dirs) {
    const filename = `tsconfig.${dir}.json`;
    const configJson = {
      extends: '../tsconfig.base.json',
      compilerOptions: {
        rootDir: `../../../packages/${dir}/src`,
        outDir: `../../../packages/${dir}/lib`,
      },
      include: [`../../../packages/${dir}/src`],
      exclude: [`../../../packages/${dir}/__mocks__`],
    };
    references.push(filename);

    await fse.writeJson(path.join(referenceDirPath, filename), configJson, { spaces: 2 });
  }

  const buildJson = await fse.readJson(buildJsonPath);

  (buildJson.references as { path: string }[]).forEach((v) => {
    if (v.path.startsWith('./references/')) {
      const f = v.path.substring('./references/'.length);
      if (!references.includes(f)) {
        console.error('unknown reference: ' + v.path);
      }
    } else {
      console.error('invalid path', v.path);
    }
  });
}

async function main() {
  const dirs = (await fse.readdir(packagesPath)).sort();
  console.log(dirs);

  const mapping = {} as { [key: string]: string };
  const toPromise = [] as Promise<any>[];
  for (const dir of dirs) {
    toPromise.push(
      (async () => {
        try {
          const targetDir = path.join(packagesPath, dir);
          const pkgJson = await fse.readJson(path.join(targetDir, 'package.json'));
          mapping[dir] = pkgJson.name;
        } catch {}
      })(),
    );
  }

  await Promise.all(toPromise);

  const sorted = new Map(Object.entries(mapping).sort((a, b) => a[0].localeCompare(b[0])));
  console.log(sorted);

  generateResolve(sorted);
  generateReferences(dirs);
}

main();
