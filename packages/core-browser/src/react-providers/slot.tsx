/**
 * 前端提供一套 Slot 的注册和渲染的机制
 */

import * as React from 'react';
import { ConfigContext } from './config-provider';
import { getLogger } from '@ali/ide-core-common';
import { LayoutConfig } from '../bootstrap';

const logger = getLogger();
export type SlotLocation = symbol | string;
export const SlotLocation = {
  root: Symbol('root'),
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

// 支持直接传Component
export function SlotRenderer({ Component }: { Component: React.FunctionComponent }) {
  return Component && <ErrorBoundary><Component /></ErrorBoundary>;
}
