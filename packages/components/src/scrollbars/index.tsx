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
  const refSetter = useCallback((scrollbarsRef) => {
    if (scrollbarsRef) {
      forwardedRef && forwardedRef(scrollbarsRef.view);
    } else {
      forwardedRef && forwardedRef(null);
    }
  }, []);
  const verticalShadowRef = useRef<HTMLDivElement | null>();
  const horizontalShadowRef = useRef<HTMLDivElement | null>();

  const handleReachBottom = React.useCallback(
    throttle((values) => {
      const { scrollTop, scrollHeight, clientHeight } = values;

      if (scrollHeight === 0 && clientHeight === 0) {
        return;
      }

      const pad = 100;
      const t = (scrollTop + pad) / (scrollHeight - clientHeight);
      if (t > 1) {
        onReachBottom && onReachBottom();
      }
    }, 100),
    [onReachBottom],
  );

  const handleUpdate = (values) => {
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
  };

  return (
    <CustomScrollbars
      ref={refSetter}
      style={{ ...style, overflow: 'hidden' }}
      className={cls(className, 'kt-scrollbar')}
      onUpdate={handleUpdate}
      onScroll={onScroll}
      renderTrackHorizontal={({ style, ...props }) => (
        <div {...props} style={{ ...style, left: 0, right: 0, bottom: 0, height: thumbSize }} />
      )}
      renderTrackVertical={({ style, ...props }) => (
        <div {...props} style={{ ...style, top: 0, right: 0, bottom: 0, width: thumbSize }} />
      )}
      renderThumbVertical={({ style, ...props }) => (
        <div {...props} style={{ ...style, width: thumbSize }} className={'scrollbar-thumb-vertical'} />
      )}
      renderThumbHorizontal={({ style, ...props }) => (
        <div {...props} style={{ ...style, height: thumbSize }} className={'scrollbar-thumb-horizontal'} />
      )}
      // renderView={(props) => <div id='xxx' {...props} />}
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

export const ScrollbarsVirtualList = React.forwardRef((props, ref) => <Scrollbars {...props} forwardedRef={ref} />);
