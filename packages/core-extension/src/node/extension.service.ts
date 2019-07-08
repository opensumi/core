import { CoreExtensionNodeService, ICoreExtension, CORE_NODE_REQUIRE_NAME, ICoreExtensionNodeContribution } from '../common';
import { readdir, pathExists, readJSON } from 'fs-extra';
import { join } from 'path';
import { Deferred, getLogger } from '@ali/ide-core-node';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';

@Injectable()
export class CoreExtensionNodeServiceImpl implements CoreExtensionNodeService {

  private extensions: ICoreExtension[]; e;

  private ready: Deferred<any> = new Deferred();

  private _apiImpl: any;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  async getExtensions(): Promise<ICoreExtension[]> {
    await this.ready.promise;
    getLogger().log('===> core-extensions', this.extensions);
    return this.extensions;
  }

  async scanExtensions(scanDir: string): Promise<void> {
    const dirs = (await readdir(scanDir));
    await Promise.all(dirs.map((dir) => createCoreExtension(join(scanDir, dir)))).then((results) => {
      this.extensions =  results.filter((result) => !!result) as ICoreExtension[];
    });
    this.ready.resolve();
  }

  hackRequire() {
    const module = require('module');
    const originalLoad = module._load;

    module._load = function load(request: string, parent: any, isMain: any) {
      if (request !== CORE_NODE_REQUIRE_NAME ) {
        return originalLoad.apply(this, arguments);
      }
      return this.apl;
    };
  }

  get apiImpl() {
    if (!this._apiImpl) {
      this._apiImpl = this.createApiImpl();
    }
    return this._apiImpl;
  }

  createApiImpl() {
    return {
      Injectable,
      Autowired,
    };
  }

  activateExtensions(): void {
    this.hackRequire();
    this.extensions.forEach((ext) => {
      try {
        if (ext.node && ext.node.entry) {
          const contribution: ICoreExtensionNodeContribution = require(join(ext.path, ext.node.entry));
          this.injector.addProviders(...contribution.getProviders());
        }
      } catch (e) {
        console.error(e);
      }
    });
  }
}

async function createCoreExtension(dir): Promise<ICoreExtension | null> {

  try {
    if (!await pathExists(join(dir, 'package.json'))) {
      return null;
    }
    const packageJSON = await readJSON(join(dir, 'package.json'));
    if (!packageJSON.kaitian) {
      return null;
    } else {
      return {
        name: packageJSON.name,
        path: dir,
        ...packageJSON.kaitian,
      };
    }
  } catch (e) {
    console.error(e);
    return null;
  }

}
