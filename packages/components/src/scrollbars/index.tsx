import cls from 'classnames';
import throttle from 'lodash/throttle';
import React, { useCallback, useEffect, useRef } from 'react';
import { Scrollbars as CustomScrollbars } from 'react-custom-scrollbars';

import { Disposable, DisposableCollection } from '@opensumi/ide-utils';
import './styles.less';

export interface ICustomScrollbarProps {
  forwardedRef?: any;
  onScroll?: any;
  onUpdate?: any;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
  onReachBottom?: any;
}

export const Scrollbars = ({
  onScroll,
  onUpdate,
  forwardedRef,
  style,
  children,
  className,
  onReachBottom,
}: ICustomScrollbarProps) => {
  const disposableCollection = useRef<DisposableCollection>(new DisposableCollection());
  const scrollerRef = useRef<HTMLDivElement>();
  const refSetter = useCallback((scrollbarsRef) => {
    if (scrollbarsRef) {
      scrollerRef.current = scrollbarsRef.view;
      forwardedRef && forwardedRef(scrollbarsRef.view);
    } else {
      forwardedRef && forwardedRef(null);
    }
  }, []);
  const verticalShadowRef = useRef<HTMLDivElement | null>();
  const horizontalShadowRef = useRef<HTMLDivElement | null>();

  const handleReachBottom = useCallback(
    (values) => {
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
  const onMouseWheel = useCallback(
    (e) => {
      if (!scrollerRef.current) {
        return;
      }
      if (scrollerRef.current.clientHeight >= scrollerRef.current.scrollHeight && e.deltaY !== 0) {
        scrollerRef.current.scrollLeft += e.deltaY;
      }
    },
    [scrollerRef.current],
  );

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.addEventListener('wheel', onMouseWheel);
      disposableCollection.current.push(
        Disposable.create(() => {
          scrollerRef.current?.removeEventListener('wheel', onMouseWheel);
        }),
      );
    }
  }, [scrollerRef.current]);

  // clear listeners
  useEffect(() => () => disposableCollection.current.dispose(), []);
  return (
    <CustomScrollbars
      ref={refSetter}
      style={{ ...style, overflow: 'hidden' }}
      className={cls(className, 'kt-scrollbar')}
      onUpdate={handleUpdate}
      onScroll={onScroll}
      renderTrackHorizontal={({ style, ...props }) => (
        <div {...props} style={{ ...style, left: 0, right: 0, bottom: 0 }} />
      )}
      renderTrackVertical={({ style, ...props }) => (
        <div {...props} style={{ ...style, top: 0, right: 0, bottom: 0 }} />
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

export const ScrollbarsVirtualList = React.forwardRef((props, ref) => <Scrollbars {...props} forwardedRef={ref} />);
