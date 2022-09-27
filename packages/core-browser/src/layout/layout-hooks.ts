import React from 'react';

import { IEventBus } from '@opensumi/ide-core-common';

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

  React.useEffect(() => {
    let lastFrame: number | null;
    const disposer = eventBus.on(ResizeEvent, (e) => {
      if (!manualObserve && e.payload.slotLocation === location) {
        if (lastFrame) {
          window.cancelAnimationFrame(lastFrame);
        }
        lastFrame = window.requestAnimationFrame(() => {
          if (containerRef.current && containerRef.current.clientHeight && containerRef.current.clientWidth) {
            setViewState({ height: containerRef.current.clientHeight, width: containerRef.current.clientWidth });
          }
        });
      }
    });
    return () => {
      disposer.dispose();
    };
  }, [containerRef.current]);

  React.useEffect(() => {
    // TODO: 统一收敛到 resizeEvent 内
    if (manualObserve && containerRef.current) {
      const ResizeObserver = (window as any).ResizeObserver;
      const doUpdate = (entries) => {
        const width = entries[0].contentRect.width;
        const height = entries[0].contentRect.height;
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
      };
      const resizeObserver = new ResizeObserver(doUpdate);
      resizeObserver.observe(containerRef.current);
      return () => {
        resizeObserver.unobserve(containerRef.current);
      };
    }
  }, []);
  return viewState;
};
