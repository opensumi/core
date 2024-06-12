import { Injectable } from '@opensumi/di';

import { CommandToken } from '../common/intell/parser';
import { IFigSpecLoader } from '../common/intell/runtime';

const versionedSpeclist = '';

// SpecLoaderImpl 类在 Node.js 层实现了 SpecLoader接口
// TODO Node 层直接读取 node_modules
@Injectable()
export class SpecLoaderNodeImpl implements IFigSpecLoader {
  private specSet: any = {}; // TODO 更好的 Type
  private loadedSpecs: { [key: string]: Fig.Spec } = {};

  constructor() {
    this.loadSpecSet();
  }

  private async loadSpecSet() {
    const speclist = (await import('@withfig/autocomplete/build/index.js')).default;
    (speclist as string[]).forEach((s) => {
      let activeSet = this.specSet;
      const specRoutes = s.split('/');
      specRoutes.forEach((route, idx) => {
        if (typeof activeSet !== 'object') {
          return;
        }
        if (idx === specRoutes.length - 1) {
          const prefix = versionedSpeclist.includes(s) ? '/index.js' : `.js`;
          // HACK: 看了一下 bundle 的补全数据，这里都是 .js，为了暂先不引入 fig 的完整依赖，这里先写死了
          // const prefix = `.js`;
          activeSet[route] = `@withfig/autocomplete/build/${s}${prefix}`;
        } else {
          activeSet[route] = activeSet[route] || {};
          activeSet = activeSet[route];
        }
      });
    });
  }

  public getSpecSet(): any {
    return this.specSet;
  }

  public async loadSpec(cmd: CommandToken[]): Promise<Fig.Spec | undefined> {
    const rootToken = cmd.at(0);
    if (!rootToken?.complete) {
      return;
    }

    if (this.loadedSpecs[rootToken.token]) {
      return this.loadedSpecs[rootToken.token];
    }
    if (this.specSet[rootToken.token]) {
      const spec = (await import(this.specSet[rootToken.token])).default;
      this.loadedSpecs[rootToken.token] = spec;
      return spec;
    }
  }

  public async lazyLoadSpec(key: string): Promise<Fig.Spec | undefined> {
    return (await import(`@withfig/autocomplete/build/${key}.js`)).default;
  }

  public async lazyLoadSpecLocation(location: Fig.SpecLocation): Promise<Fig.Spec | undefined> {
    return;
  }
}
