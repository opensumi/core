import * as React from 'react';
import * as styles from './resize.module.less';
import classnames from 'classnames';

export interface ResizeHandleProps {
  onFinished?: () => void;
  onResize?: () => void;
  max?: number;
  min?: number;
  preserve?: number; // percentage
  className?: string;
}

export const ResizeHandleHorizontal = (props: ResizeHandleProps) => {
  const ref = React.useRef<HTMLElement | null>();
  const resizing = React.useRef<boolean>(false);
  const startX = React.useRef<number>(0);
  const startPrevWidth = React.useRef<number>(0);
  const startNextWidth = React.useRef<number>(0);
  const prevElement = React.useRef<HTMLElement | null>();
  const nextElement = React.useRef<HTMLElement | null>();
  const requestFrame = React.useRef<number>();

  const onMouseMove =  ((e) => {
    const prevWidth = startPrevWidth.current + e.pageX - startX.current;
    const nextWidth = startNextWidth.current - ( e.pageX - startX.current);
    const preserve = props.preserve || 0;
    if (requestFrame.current) {
      window.cancelAnimationFrame(requestFrame.current);
    }
    const parentWidth = ref.current!.parentElement!.offsetWidth;
    requestFrame.current = window.requestAnimationFrame(() => {
      nextElement.current!.style.width = (nextWidth / parentWidth) * 100 + '%';
      prevElement.current!.style.width = (prevWidth / parentWidth) * 100 + '%';
      if (props.onResize) {
        props.onResize();
      }
    });

  });
  const onMouseUp = ((e) => {
    resizing.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    if (props.onFinished) {
      props.onFinished();
    }
  });
  const onMouseDown =  ((e) => {
    resizing.current = true;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    startX.current = e.pageX;
    startPrevWidth.current = prevElement.current!.offsetWidth;
    startNextWidth.current = nextElement.current!.offsetWidth;
  });
  React.useEffect(() => {
    if (ref.current) {
      ref.current.addEventListener('mousedown', onMouseDown);
      prevElement.current = ref.current.previousSibling as HTMLElement;
      nextElement.current = ref.current.nextSibling as HTMLElement;
    }

    return () => {
      if (ref.current) {
        ref.current.removeEventListener('mousedown', onMouseDown);
        ref.current.removeEventListener('mousemove', onMouseMove);
        ref.current.removeEventListener('mouseup', onMouseUp);
      }
    };
  }, []);

  return (
    <div ref={(e) => {ref.current = e; } } className={classnames({
      [styles['resize-handle-horizontal']]: true,
    })}/>
  );
};
export const ResizeHandleVertical = (props: ResizeHandleProps) => {
  const ref = React.useRef<HTMLElement>();
  const resizing = React.useRef<boolean>(false);
  const startY = React.useRef<number>(0);
  const startHeight = React.useRef<number>(0);
  const startPrevHeight = React.useRef<number>(0);
  const startNextHeight = React.useRef<number>(0);
  const prevElement = React.useRef<HTMLElement>();
  const nextElement = React.useRef<HTMLElement>();
  const requestFrame = React.useRef<number>();

  const onMouseDown = ((e) => {
    resizing.current = true;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    startY.current = e.pageY;
    startPrevHeight.current = prevElement.current!.offsetHeight;
    startNextHeight.current = nextElement.current!.offsetHeight;
  });

  const onMouseMove = ((e) => {
    const prevHeight = startPrevHeight.current + e.pageY - startY.current;
    const nextHeight = startNextHeight.current - ( e.pageY - startY.current);
    const preserve = props.preserve || 0;
    if (requestFrame.current) {
      window.cancelAnimationFrame(requestFrame.current);
    }
    const parentHeight = ref.current!.parentElement!.offsetHeight;
    requestFrame.current = window.requestAnimationFrame(() => {
      nextElement.current!.style.height = (nextHeight / parentHeight) * 100 + '%';
      prevElement.current!.style.height = (prevHeight / parentHeight) * 100 + '%';
      if (props.onResize) {
        props.onResize();
      }
    });
  });

  const onMouseUp = ((e) => {
    resizing.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    if (props.onFinished) {
      props.onFinished();
    }
  });

  React.useEffect(() => {
    ref.current!.addEventListener('mousedown', onMouseDown);
    prevElement.current = ref.current!.previousSibling as HTMLElement;
    nextElement.current = ref.current!.nextSibling as HTMLElement;

    return () => {
      ref.current!.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (<div ref={(e) => e && (ref.current = e) } className={classnames({
    [styles['resize-handle-vertical']]: true,
    [props.className || '']: true,
  })}/>);

};
