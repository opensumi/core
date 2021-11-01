/**
 * 前端提供一套 Slot 的注册和渲染的机制
 */

import React from 'react';
import { getDebugLogger } from '@ali/ide-core-common';
import { LayoutConfig } from '../bootstrap';
import { useInjectable } from '../react-hooks';
import { ComponentRegistry, ComponentRegistryInfo } from '../layout';
import { ConfigContext } from './config-provider';
import { Button } from '@ali/ide-components';
import { IClientApp } from '../browser-module';

const logger = getDebugLogger();
export type SlotLocation = string;
export const SlotLocation = {
  top: 'top',
  left: 'left',
  right: 'right',
  main: 'main',
  statusBar: 'statusBar',
  bottom: 'bottom',
  extra: 'extra',
  float: 'float',
  action: 'action',
  // @deprecated ->
  bottomBar: 'bottomBar',
  bottomPanel: 'bottomPanel',
  leftBar: 'leftBar',
  leftPanel: 'leftPanel',
  rightBar: 'rightBar',
  rightPanel: 'rightPanel',
  // <- @deprecated
};

export function getSlotLocation(module: string, layoutConfig: LayoutConfig) {
  for (const location of Object.keys(layoutConfig)) {
    if (layoutConfig[location].modules && layoutConfig[location].modules.indexOf(module) > -1) {
      return location;
    }
  }
  getDebugLogger().warn(`没有找到${module}所对应的位置！`);
  return '';
}

export enum TabbarContextKeys {
  activeViewlet = 'activeViewlet',
  activePanel = 'activePanel',
  activeExtendViewlet = 'activeExtendViewlet',
}

export function getTabbarCtxKey(location: string): TabbarContextKeys {
  const standardTabbarCtxKeys = {
    [SlotLocation.left]: TabbarContextKeys.activeViewlet,
    [SlotLocation.right]: TabbarContextKeys.activeExtendViewlet,
    [SlotLocation.bottom]: TabbarContextKeys.activePanel,
  };

  return standardTabbarCtxKeys[location] || 'activeExtendViewlet';
}

export class ErrorBoundary extends React.Component {
  state = { error: null, errorInfo: null };

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
    });
    setTimeout(() => {
      throw error; // 让上层错误抓取能捕获这个错误
    });
    logger.error(errorInfo);
  }

  update() {
    this.setState({error: null, errorInfo: null});
  }

  render() {
    if (this.state.errorInfo) {
      return (
        <div>
          <h2>模块渲染异常</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && (this.state.error as any).toString()}
            <br />
            {(this.state.errorInfo as any).componentStack}
          </details>
          <Button onClick={() => this.update()}>重新加载</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const allSlot: {slot: string, dom: HTMLElement}[] = [];

export const SlotDecorator: React.FC<{ slot: string, color?: string }> = ({slot, ...props}) => {
  const ref = React.useRef<HTMLElement>();
  React.useEffect(() => {
    if (ref.current) {
      allSlot.push({slot, dom: ref.current});
    }
  }, [ref]);
  return <div ref={(ele) => ref.current = ele!} className='resize-wrapper' style={props.color ? {backgroundColor: props.color} : {}}>{props.children}</div>;
};

export interface RendererProps { components: ComponentRegistryInfo[]; }
export type Renderer = React.ComponentType<RendererProps>;

export class SlotRendererRegistry {
  static DefaultRenderer({ components }: RendererProps) {
    return components && <ErrorBoundary>
      {
        components.map((componentInfo, index: number) => {
          // 默认的只渲染一个
          const Component = componentInfo.views[0].component!;
          return <Component {...(componentInfo.options && componentInfo.options.initialProps)} key={`${Component.name}-${index}`} />;
        })
      }
    </ErrorBoundary>;
  }

  protected tabbarLocation = new Set<string>();

  protected rendererRegistry: Map<string, Renderer> = new Map();

  registerSlotRenderer(slot: string, renderer: Renderer) {
    this.rendererRegistry.set(slot, renderer);
  }

  getSlotRenderer(slot: string): Renderer {
    return this.rendererRegistry.get(slot) || SlotRendererRegistry.DefaultRenderer;
  }

  addTabbar(slot: string) {
    if (!this.tabbarLocation.has(slot)) {
      this.tabbarLocation.add(slot);
    }
  }

  isTabbar(slot: string) {
    return this.tabbarLocation.has(slot);
  }

}

export const slotRendererRegistry = new SlotRendererRegistry();

export function SlotRenderer({ slot, isTabbar, ...props }: any) {
  const componentRegistry = useInjectable<ComponentRegistry>(ComponentRegistry);
  const appConfig = React.useContext(ConfigContext);
  const clientApp = useInjectable<IClientApp>(IClientApp);
  const componentKeys = appConfig.layoutConfig[slot]?.modules;
  if (isTabbar) {
    slotRendererRegistry.addTabbar(slot);
  }
  if (!componentKeys || !componentKeys.length) {
    getDebugLogger().warn(`${slot}位置未声明任何视图`);
  }
  const [componentInfos, setInfos] = React.useState<ComponentRegistryInfo[]>([]);
  const updateComponentInfos = React.useCallback(() => {
    const infos: ComponentRegistryInfo[] = [];
    componentKeys.forEach((token) => {
      const info = componentRegistry.getComponentRegistryInfo(token);
      if (!info) {
        getDebugLogger().warn(`${token}对应的组件不存在，请检查`);
      } else {
        infos.push(info);
      }
    });
    setInfos(infos);
  }, []);
  React.useEffect(() => {
    // 对于嵌套在模块视图的SlotRenderer，渲染时应用已启动
    clientApp.appInitialized.promise.then(updateComponentInfos);
  }, []);

  const Renderer = slotRendererRegistry.getSlotRenderer(slot);
  return <ErrorBoundary>
    <SlotDecorator slot={slot} color={props.color}>
      <Renderer components={componentInfos} {...props} />
    </SlotDecorator>
  </ErrorBoundary>;
}

export interface SlotRendererContribution {
  registerRenderer(registry: SlotRendererRegistry): void;
}
export const SlotRendererContribution = Symbol('SlotRendererContribution');

export interface SlotRendererProps {
  Component: React.ComponentType<any> | React.ComponentType<any>[];
  initialProps?: object;
}
// @deprecated
export function ComponentRenderer({ Component, initialProps }: SlotRendererProps ) {
  if (Array.isArray(Component)) {
    return Component && <ErrorBoundary>
      {
        Component.map((Component, index: number) => {
          return <Component {...(initialProps || {})} key={`${Component.name}-${index}`}/>;
        })
      }
    </ErrorBoundary>;
  } else {
    return Component && <ErrorBoundary>
      <Component {...(initialProps || {})} />
    </ErrorBoundary>;
  }
}
