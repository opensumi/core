import { EditorComponentRegistry, IEditorComponent, IEditorComponentResolver, IEditorPayload } from './types';
import { IDisposable } from '@ali/ide-core-common';
import { IResource } from '../common';
import { Injectable } from '@ali/common-di';

@Injectable()
export class EditorComponentRegistryImpl implements EditorComponentRegistry {

  private components: Map<string, IEditorComponent> = new Map();

  private resolvers: Map<string, IEditorComponentResolver[]> = new Map();

  public registerEditorComponent<T>(component: IEditorComponent<T>): IDisposable {
    const uid = component.uid;
    this.components.set(uid, component);
    return {
      dispose: () => {
        if (this.components.get(uid) === component) {
          this.components.delete(uid);
        }
      },
    };
  }

  public registerEditorComponentResolver<T>(scheme: string, resolver: IEditorComponentResolver<any>): IDisposable {
    this.getResolvers(scheme).unshift(resolver); // 后来的resolver先处理
    return {
      dispose: () => {
        const index = this.getResolvers(scheme).indexOf(resolver);
        if (index !== -1) {
          this.getResolvers(scheme).splice(index, 1);
        }
      },
    };
  }
  public async resolveEditorComponent(resource: IResource): Promise<IEditorPayload[]> {
    let results = [];
    const resolvers = this.getResolvers(resource.uri.scheme).slice(); // 防止异步操作时数组被改变
    let shouldBreak = false;
    const resolve = (res) => {
      results = res;
      shouldBreak = true;
    };
    for (const resolver of resolvers) {
      await resolver(resource, results, resolve);
      if (shouldBreak) {
        break;
      }
    }
    return results;
  }

  private getResolvers(scheme: string): IEditorComponentResolver[] {
    if (!this.resolvers.has(scheme)) {
      this.resolvers.set(scheme, []);
    }
    return this.resolvers.get(scheme) as IEditorComponentResolver[];
  }

  public getEditorComponent(id: string): IEditorComponent | null {
    return this.components.get(id) || null;
  }

}
