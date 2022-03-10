import ReactDOM from 'react-dom';

import { Injectable, Autowired } from '@opensumi/di';
import { ExtensionActivateEvent, IDisposable, IEventBus } from '@opensumi/ide-core-common';

import { IResource, IEditorOpenType } from '../common';

import {
  EditorComponentRegistry,
  IEditorComponent,
  IEditorComponentResolver,
  EditorComponentRenderMode,
  IEditorSideWidget,
  EditorSide,
  EditorComponentDisposeEvent,
  RegisterEditorComponentEvent,
  RegisterEditorSideComponentEvent,
} from './types';


type SchemeKey = string;

interface INormalizedEditorComponentResolver {
  handleScheme: (scheme: string) => number;
  resolver: IEditorComponentResolver;
}

@Injectable()
export class EditorComponentRegistryImpl implements EditorComponentRegistry {
  @Autowired(IEventBus)
  eventBus: IEventBus;

  private components: Map<string, IEditorComponent> = new Map();

  private sideWidgets = {
    bottom: new Set<IEditorSideWidget>(),
  };

  private initialPropsMap: Map<string, any> = new Map();

  private resolvers: Map<SchemeKey, IEditorComponentResolver[]> = new Map();

  private normalizedResolvers: INormalizedEditorComponentResolver[] = [];

  public readonly perWorkbenchComponents = {};

  public registerEditorComponent<T>(component: IEditorComponent<T>, initialProps?: any): IDisposable {
    const uid = component.uid;
    if (!component.renderMode) {
      component.renderMode = EditorComponentRenderMode.ONE_PER_GROUP;
    }
    this.components.set(uid, component);
    this.initialPropsMap.set(uid, initialProps);
    // 使用 activationEvent 通知插件
    this.eventBus.fire(new ExtensionActivateEvent({ topic: 'onRegisterEditorComponent', data: uid }));
    this.eventBus.fire(new RegisterEditorComponentEvent(uid));
    return {
      dispose: () => {
        if (this.components.get(uid) === component) {
          this.components.delete(uid);
          this.eventBus.fire(new EditorComponentDisposeEvent(component));
        }
      },
    };
  }

  public registerEditorComponentResolver<T>(
    scheme: string | ((scheme: string) => number),
    resolver: IEditorComponentResolver<any>,
  ): IDisposable {
    let normalizedResolver: INormalizedEditorComponentResolver;
    if (typeof scheme === 'function') {
      normalizedResolver = {
        handleScheme: scheme,
        resolver,
      };
    } else {
      normalizedResolver = {
        handleScheme: (s: string) => (s === scheme ? 10 : -1),
        resolver,
      };
    }
    this.normalizedResolvers.push(normalizedResolver);

    // 注册了新的，清除缓存
    this.resolvers.clear();
    return {
      dispose: () => {
        // 去除已被 cache 的resolver
        for (const resolvers of this.resolvers.values()) {
          const index = resolvers.indexOf(resolver);
          if (index !== -1) {
            resolvers.splice(index, 1);
          }
        }

        const i = this.normalizedResolvers.indexOf(normalizedResolver);
        if (i !== -1) {
          this.normalizedResolvers.splice(i, 1);
        }
      },
    };
  }

  public async resolveEditorComponent(resource: IResource): Promise<IEditorOpenType[]> {
    let results: IEditorOpenType[] = [];
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
    results.sort((a, b) => {
      const wa = a.weight || 0;
      const wb = b.weight || 0;
      return wb - wa;
    });
    return results;
  }

  private calculateSchemeResolver(scheme: string): IEditorComponentResolver[] {
    const resolvers = this.normalizedResolvers.slice();
    const calculated: {
      weight: number; // handleScheme 的权重
      index: number; // resolver 在resolver中的位置(后来的先处理)
      resolver: IEditorComponentResolver;
    }[] = [];

    resolvers.forEach((r, index) => {
      const weight = r.handleScheme(scheme);
      if (weight >= 0) {
        calculated.push({
          weight,
          index,
          resolver: r.resolver,
        });
      }
    });

    return calculated
      .sort((a, b) => {
        if (a.weight > b.weight) {
          return -1;
        } else if (a.weight < b.weight) {
          return 1;
        } else {
          return b.index - a.index;
        }
      })
      .map((c) => c.resolver);
  }

  private getResolvers(scheme: string): IEditorComponentResolver[] {
    if (!this.resolvers.has(scheme)) {
      this.resolvers.set(scheme, this.calculateSchemeResolver(scheme));
    }
    return this.resolvers.get(scheme) as IEditorComponentResolver[];
  }

  public getEditorComponent(id: string): IEditorComponent | null {
    return this.components.get(id) || null;
  }

  public getEditorInitialProps(id: string): any {
    return this.initialPropsMap.get(id) || null;
  }

  public clearPerWorkbenchComponentCache(componentId: string) {
    ReactDOM.unmountComponentAtNode(this.perWorkbenchComponents[componentId]);
    delete this.perWorkbenchComponents[componentId];
  }

  public getSideWidgets(side: EditorSide, resource: IResource): IEditorSideWidget<any>[] {
    const res: IEditorSideWidget<any>[] = [];
    this.sideWidgets[side].forEach((widget) => {
      if (widget.displaysOnResource(resource)) {
        res.push(widget);
      }
    });
    return res.sort((w1, w2) => {
      const weight1 = w1.weight === undefined ? 10 : w1.weight;
      const weight2 = w2.weight === undefined ? 10 : w2.weight;
      return weight2 - weight1;
    });
  }

  public registerEditorSideWidget(widget: IEditorSideWidget<any>): IDisposable {
    const side = widget.side || 'bottom';
    this.sideWidgets[side].add(widget);
    this.eventBus.fire(new RegisterEditorSideComponentEvent());
    return {
      dispose: () => {
        this.sideWidgets[side].delete(widget);
      },
    };
  }
}
