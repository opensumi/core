/**
 * 前端提供一套 Slot 的注册和渲染的机制
 */

import * as React from 'react';
import { getLogger } from '@ali/ide-core-common';
import { LayoutConfig } from '../bootstrap';
import { useInjectable } from '../react-hooks';
import { ComponentRegistry, ComponentRegistryInfo } from '../layout';
import { AppConfig } from './config-provider';

const logger = getLogger();
export type SlotLocation = string;
export const SlotLocation = {
  top: 'top',
  left: 'left',
  right: 'right',
  main: 'main',
  statusBar: 'statusBar',
  bottom: 'bottom',
  bottomBar: 'bottomBar',
  bottomPanel: 'bottomPanel',
  leftBar: 'leftBar',
  leftPanel: 'leftPanel',
  rightBar: 'rightBar',
  rightPanel: 'rightPanel',
  extra: 'extra',
  float: 'float',
};

export function getSlotLocation(module: string, layoutConfig: LayoutConfig) {
  for (const location of Object.keys(layoutConfig)) {
    if (layoutConfig[location].modules.indexOf(module) > -1) {
      return location;
    }
  }
  getLogger().warn(`没有找到${module}所对应的位置！`);
  return '';
}

export class ErrorBoundary extends React.Component {
  state = { error: null, errorInfo: null };

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
    });
    logger.error(errorInfo);
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
        </div>
      );
    }
    return this.props.children;
  }
}

export interface RendererProps { components: ComponentRegistryInfo[]; }
export type Renderer = React.FunctionComponent<RendererProps>;

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

  rendererRegistry: Map<string, Renderer> = new Map();

  registerSlotRenderer(slot: string, renderer: Renderer) {
    this.rendererRegistry.set(slot, renderer);
  }

  getSlotRenderer(slot: string): Renderer {
    return this.rendererRegistry.get(slot) || SlotRendererRegistry.DefaultRenderer;
  }
}

export const slotRendererRegistry = new SlotRendererRegistry();

export function SlotRenderer({ slot, ...props }: any) {
  const componentRegistry = useInjectable<ComponentRegistry>(ComponentRegistry);
  const layoutConfig = useInjectable<AppConfig>(AppConfig).layoutConfig;
  const componentKeys = layoutConfig[slot].modules;
  if (!componentKeys) {
    console.warn(`${slot}位置未声明任何视图`);
  }
  const componentInfos: ComponentRegistryInfo[] = [];
  componentKeys.forEach((token) => {
    const info = componentRegistry.getComponentRegistryInfo(token);
    if (!info) {
      console.warn(`${token}对应的组件不存在，请检查`);
    } else {
      componentInfos.push(info);
    }
  });
  const Renderer = slotRendererRegistry.getSlotRenderer(slot);
  return <ErrorBoundary>
    <Renderer components={componentInfos} {...props} />
  </ErrorBoundary>;
}

export interface SlotRendererContribution {
  registerRenderer(registry: SlotRendererRegistry): void;
}
export const SlotRendererContribution = Symbol('SlotRendererContribution');

export interface SlotRendererProps {
  Component: React.FunctionComponent<any> | React.FunctionComponent<any>[];
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
