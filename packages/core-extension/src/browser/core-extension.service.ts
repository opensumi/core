import { Injectable } from '@ali/common-di';
import { define } from '_@types_mime@2.0.1@@types/mime';
import { BrowserModule, Domain, ClientAppContribution } from '@ali/ide-core-browser';
import { resolve } from 'path';

interface AMDRequire {
  config: (options: any) => void;
  (modules: string[], callback: (module: any) => void): Promise<any>;
}

function getAMDRequire(): AMDRequire {
  return (global as any).require;
}

@Injectable()
export class CoreExtensionService {

  init() {
    (global as any).define('kaitian', [] , () => {
      return {
        BrowserModule,
        Domain,
        ClientAppContribution,
        Injectable,
      };
    });
  }

  async loadBrowser(extPath): Promise<BrowserModule[]> {
    return new Promise((resolve) => {
      getAMDRequire()([extPath], (exported) => {
        console.log('==>exported', exported);
        resolve(exported.provideModules());
      });
    });
  }

}
