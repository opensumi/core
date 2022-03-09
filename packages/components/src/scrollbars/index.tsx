import cls from 'classnames';
import throttle from 'lodash/throttle';
import React from 'react';
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
  const refSetter = React.useCallback((scrollbarsRef) => {
    if (scrollbarsRef) {
      forwardedRef && forwardedRef(scrollbarsRef.view);
    } else {
      forwardedRef && forwardedRef(null);
    }
  }, []);

  let shadowTopRef: HTMLDivElement | null;

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
    const { scrollTop } = values;
    const shadowTopOpacity = (1 / 20) * Math.min(scrollTop, 20);
    if (shadowTopRef) {
      shadowTopRef.style.opacity = String(shadowTopOpacity);
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
      renderThumbVertical={({ style, ...props }) => <div {...props} className={'scrollbar-thumb-vertical'} />}
      renderThumbHorizontal={({ style, ...props }) => <div {...props} className={'scrollbar-thumb-horizontal'} />}
    >
      <div
        ref={(ref) => {
          shadowTopRef = ref;
        }}
        className={'scrollbar-decoration'}
      />
      {children}
    </CustomScrollbars>
  );
};

export const ScrollbarsVirtualList = React.forwardRef((props, ref) => <Scrollbars {...props} forwardedRef={ref} />);
