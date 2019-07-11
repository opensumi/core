import { Injectable, Autowired, Provider, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { define } from '_@types_mime@2.0.1@@types/mime';
import { BrowserModule, Domain, ClientAppContribution, URI, getLogger, isNodeIntegrated } from '@ali/ide-core-browser';
import { resolve } from 'path';
import { CoreExtensionNodeServiceServerPath, CoreExtensionNodeService, CORE_BROWSER_REQUIRE_NAME, ICoreExtensionBrowserContribution } from '../common';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';

interface AMDRequire {
  config: (options: any) => void;
  (modules: string[], callback: (module: any) => void): Promise<any>;
}

function getAMDRequire(): AMDRequire {
  if (isNodeIntegrated()) {
    return (global as any).amdLoader.require;
  } else {
    return (global as any).amdLoader.require;
  }
}

function getAMDDefine(): any {
  if (isNodeIntegrated()) {
    return (global as any).amdLoader.require.define;
  } else {
    return (global as any).amdLoader.define;
  }
}

@Injectable()
export class CoreExtensionService {

  @Autowired(CoreExtensionNodeServiceServerPath)
  coreExtensionNodeService: CoreExtensionNodeService;

  @Autowired()
  staticResourceService: StaticResourceService;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  initExports() {
    getAMDDefine()(CORE_BROWSER_REQUIRE_NAME, [] , () => {
      return {
        BrowserModule,
        Domain,
        ClientAppContribution,
        Injectable,
      };
    });
  }

  async activate() {
    const extensions = await this.coreExtensionNodeService.getExtensions();
    this.initExports();

    await Promise.all(
      extensions.map(async (e) => {
        if (e.browser) {
          if (e.browser.entry) {
            try {
              const scriptURI = await this.staticResourceService.resolveStaticResource(URI.file(e.path).resolve(e.browser.entry));
              const exported = await this.loadBrowser(scriptURI.toString());
              this.injector.addProviders(...exported.getProviders());
            } catch (e) {
              console.error(e);
            }
          }
        }
      }),
    );

  }

  async loadBrowser(extPath): Promise<ICoreExtensionBrowserContribution> {
    return new Promise((resolve) => {
      getAMDRequire()([extPath], (exported) => {
        getLogger().log('==>exported', exported);
        resolve(exported);
      });
    });
  }

}
