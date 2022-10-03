import cls from 'classnames';
import throttle from 'lodash/throttle';
import React, { useCallback, useRef } from 'react';
import { Scrollbars as CustomScrollbars } from 'react-custom-scrollbars';
import './styles.less';

export interface ICustomScrollbarProps {
  forwardedRef?: any;
  onScroll?: any;
  onUpdate?: any;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
  onReachBottom?: any;
  thumbSize?: number;
}

export const Scrollbars = ({
  onScroll,
  onUpdate,
  forwardedRef,
  style,
  children,
  className,
  onReachBottom,
  thumbSize = 10,
}: ICustomScrollbarProps) => {
  const refSetter = useCallback(
    (scrollbarsRef) => {
      if (!scrollbarsRef) {
        return;
      }

      if (!forwardedRef) {
        return;
      }

      if (typeof forwardedRef === 'function') {
        forwardedRef(scrollbarsRef.view);
      } else {
        forwardedRef.current = scrollbarsRef.view;
      }
    },
    [forwardedRef],
  );

  const verticalShadowRef = useRef<HTMLDivElement | null>();
  const horizontalShadowRef = useRef<HTMLDivElement | null>();

  const handleReachBottom = useCallback(
    (values) => {
      if (!values) {
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = values;

      if (scrollHeight === 0 && clientHeight === 0) {
        return;
      }

      const pad = 100;
      const t = (scrollTop + pad) / (scrollHeight - clientHeight);
      if (t > 1) {
        onReachBottom && onReachBottom();
      }
    },
    [onReachBottom],
  );

  const handleUpdate = useCallback(
    throttle((values) => {
      if (!values) {
        return;
      }
      const { scrollTop, scrollLeft } = values;
      const shadowTopOpacity = (1 / 20) * Math.min(scrollTop, 20);
      const shadowLeftOpacity = (1 / 20) * Math.min(scrollLeft, 20);
      if (verticalShadowRef.current) {
        verticalShadowRef.current.style.opacity = String(shadowTopOpacity);
      }
      if (horizontalShadowRef.current) {
        horizontalShadowRef.current.style.opacity = String(shadowLeftOpacity);
      }
      handleReachBottom(values);
      onUpdate && onUpdate(values);
    }, 100),
    [onUpdate, handleReachBottom, verticalShadowRef.current, horizontalShadowRef.current],
  );

  return (
    <CustomScrollbars
      ref={refSetter}
      style={{ ...style, overflow: 'hidden' }}
      className={cls(className, 'kt-scrollbar')}
      onUpdate={handleUpdate}
      onScroll={onScroll}
      renderTrackHorizontal={({ style, ...props }) => (
        <div {...props} style={{ ...style, left: 0, right: 0, bottom: 0 }} className={'scrollbar-track'} />
      )}
      renderTrackVertical={({ style, ...props }) => (
        <div {...props} style={{ ...style, top: 0, right: 0, bottom: 0 }} className={'scrollbar-track'} />
      )}
      renderThumbVertical={({ style, ...props }) => (
        <div {...props} style={{ ...style }} className={'scrollbar-thumb-vertical'} />
      )}
      renderThumbHorizontal={({ style, ...props }) => (
        <div {...props} style={{ ...style }} className={'scrollbar-thumb-horizontal'} />
      )}
    >
      <div
        ref={(ref) => {
          verticalShadowRef.current = ref;
        }}
        className={'scrollbar-decoration-vertical'}
      />
      <div
        ref={(ref) => {
          horizontalShadowRef.current = ref;
        }}
        className={'scrollbar-decoration-horizontal'}
      />
      {children}
    </CustomScrollbars>
  );
};
Scrollbars.displayName = 'CustomScrollbars';

export const ScrollbarsVirtualList = React.forwardRef((props, ref) => <Scrollbars {...props} forwardedRef={ref} />);
ScrollbarsVirtualList.displayName = 'ScrollbarsVirtualList';
