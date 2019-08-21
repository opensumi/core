/**
 * 前端提供一套 Slot 的注册和渲染的机制
 */

import * as React from 'react';
import { getLogger } from '@ali/ide-core-common';
import { LayoutConfig } from '../bootstrap';

const logger = getLogger();
export type SlotLocation = string;
export const SlotLocation =  {
  top: 'top',
  left: 'left',
  right: 'right',
  main: 'main',
  bottom: 'bottom',
  bottomBar: 'bottomBar',
  leftBar: 'leftBar',
  leftPanel: 'leftPanel',
  rightBar: 'rightBar',
  rightPanel: 'rightPanel',
};

export function getSlotLocation(module: string, layoutConfig: LayoutConfig) {
  for (const location of Object.keys(layoutConfig)) {
    if (layoutConfig[location].modules.indexOf(module) > -1) {
      return location;
    }
  }
  console.error(`没有找到${module}所对应的位置！`);
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

export interface SlotRendererProps {
  Component: React.FunctionComponent<any> | React.FunctionComponent<any>[];
  initialProps?: object;
}

// 支持直接传Component
export function SlotRenderer({ Component, initialProps }: SlotRendererProps ) {
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
