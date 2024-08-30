import throttle from 'lodash/throttle';
import React from 'react';

import { IEventBus } from '@opensumi/ide-core-common';

import { fastdom } from '../dom';
import { useInjectable } from '../react-hooks';

import { ResizeEvent } from './layout.interface';

export interface ViewState {
  width: number;
  height: number;
}

export const useViewState = (
  location: string,
  containerRef: React.MutableRefObject<HTMLElement | null | undefined>,
  manualObserve?: boolean,
): ViewState => {
  const eventBus = useInjectable<IEventBus>(IEventBus);
  const [viewState, setViewState] = React.useState({ width: 0, height: 0 });
  const viewStateRef = React.useRef<ViewState>(viewState);

  const updateViewState = throttle(
    (height: number, width: number) => {
      // 当视图被隐藏 (display: none) 时不更新 viewState
      // 避免视图切换时触发无效的渲染
      // 真正的 resize 操作不会出现 width/height 为 0 的情况
      if (
        (width !== viewStateRef.current.width || height !== viewStateRef.current.height) &&
        (width !== 0 || height !== 0)
      ) {
        setViewState({ width, height });
        viewStateRef.current = { width, height };
      }
    },
    16 * 3,
    {
      leading: true,
      trailing: true,
    },
  );

  React.useEffect(() => {
    const disposer = eventBus.onDirective(ResizeEvent.createDirective(location), () => {
      if (!manualObserve) {
        fastdom.measureAtNextFrame(() => {
          if (containerRef.current) {
            const height = containerRef.current.clientHeight;
            const width = containerRef.current.clientWidth;

            updateViewState(height, width);
          }
        });
      }
    });
    return () => {
      disposer.dispose();
    };
  }, []);

  React.useEffect(() => {
    const ResizeObserver = window.ResizeObserver;
    // TODO: 统一收敛到 resizeEvent 内
    if (manualObserve && containerRef.current) {
      const resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
        const width = entries[0].contentRect.width;
        const height = entries[0].contentRect.height;
        updateViewState(height, width);
      });
      resizeObserver.observe(containerRef.current);
      return () => {
        if (containerRef.current) {
          resizeObserver.unobserve(containerRef.current);
        }
      };
    }
  }, []);
  return viewState;
};
