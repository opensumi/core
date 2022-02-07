import fse from 'fs-extra';
import path from 'path';

async function main() {
  const packagesPath = path.join(__dirname, '../packages');
  const dirs = await fse.readdir(packagesPath);
  console.log(dirs);
  const mapping = {} as { [key: string]: string };
  const toPromise = [] as Promise<any>[];
  for (const dir of dirs) {
    toPromise.push(
      (async () => {
        const targetDir = path.join(packagesPath, dir);
        try {
          const pkgJson = await fse.readJson(path.join(targetDir, 'package.json'));
          mapping[dir] = pkgJson.name;
        } catch {}
      })(),
    );
  }
  await Promise.all(toPromise);
  console.log(`🚀 ~ file: generate-paths.ts ~ line 18 ~ main ~ result`, mapping);

  const paths = {};
  // "@opensumi/ide-core-common": ["../packages/core-common/src/index.ts"],
  // "@opensumi/ide-core-common/lib/*": ["../packages/core-common/src/*"],
  for (const [dir, pkgName] of Object.entries(mapping)) {
    paths[pkgName] = ['../packages/' + dir + '/src/index.ts'];
    paths[pkgName + '/lib/*'] = ['../packages/' + dir + '/src/*'];
  }
  console.log(paths);

  const configJsonPath = path.join(__dirname, '../configs/ts/tsconfig.resolve.json');
  const configJson = await fse.readJson(configJsonPath);
  configJson.compilerOptions.paths = paths;
  await fse.writeJson(configJsonPath, configJson, { spaces: 2 });
}

main();
