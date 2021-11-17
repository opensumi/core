import { join } from 'path';
import { readdirSync, existsSync } from 'fs';
import { readJSONSync, readFileSync, writeFileSync } from 'fs-extra';
import { execSync } from 'child_process';
import { argv } from 'yargs';

export default class Package {

  path: string;

  name: string;

  packageJsonFile: string;

  constructor(path: string) {
    this.path = path;
    this.packageJsonFile = join(this.path, 'package.json');
    this.name = readJSONSync(this.packageJsonFile).name;
  }

  modifyPackageJson(version: string, packages: Package[], subscriptions) {
    const original: string = readFileSync(this.packageJsonFile, 'utf8');
    subscriptions.push({
      dispose: () => {
        writeFileSync(this.packageJsonFile, original);
      },
    });
    const json = JSON.parse(original);
    json.version = version;
    json.dependencies = this.modifyDeps(json.dependencies, version,  packages);
    json.devDependencies = this.modifyDeps(json.devDependencies, version, packages);
    json.optionalDependencies = this.modifyDeps(json.optionalDependencies, version, packages);
    json.peerDependencies = this.modifyDeps(json.peerDependencies, version, packages);
    if (json.private) {
      json.private = false;
    }
    if (!json.publishConfig) {
      json.publishConfig = {};
    }
    json.publishConfig.registry = 'http://registry.npmjs.com';
    writeFileSync(this.packageJsonFile, `${JSON.stringify(json, null, 2)}\n`);
  }

  modifyDeps(deps: {[key: string]: string} | undefined, version: string, packages: Package[]): {[key: string]: string} | undefined {
    if (deps) {
      const result = {};
      Object.keys(deps).forEach((key) => {
        if (packages.some((pkg) => pkg.name === key)) {
          result[key] = version;
        } else {
          result[key] = deps[key];
        }
      });
      return result;
    }
  }

  distTag(version: string, tag: string) {
    execSync(`tnpm dist-tag add ${this.name}@${version} ${tag}`, {
      cwd: this.path,
      env: process.env,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    process.stdout.write('  ok!\n');
  }

  publish(version, packages: Package[], distTag, subscriptions) {
    process.stdout.write(`[正在更新版本号] ${this.name}@${version}`);
    this.modifyPackageJson(version, packages, subscriptions);

    if (!argv.versionOnly) {
      process.stdout.write(`[正在发布] ${this.name}@${version}`);
      this.doPublish(distTag);
    }
  }

  doPublish(distTag = 'latest') {
    execSync(`tnpm publish --tag=${distTag}`, {
      cwd: this.path,
      env: process.env,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    process.stdout.write('  publish ok!\n');
  }
}

export const PACKAGE_DIR = join(__dirname, '../packages');

export function readAllMainPackages(packageDir = PACKAGE_DIR) {
  const packages: Package[] = [];

  const packagesDirNames = readdirSync(packageDir);

  packagesDirNames.forEach((name) => {
    if (name.startsWith('.') || !existsSync(join(packageDir, name, 'package.json'))) {
      return;
    }
    const pkg = new Package(join(packageDir, name))
    packages.push(pkg);
  });
  return packages;
}
