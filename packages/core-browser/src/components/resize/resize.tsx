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
  delegate?: (delegate: IResizeHandleDelegate) => void;
}

export interface IResizeHandleDelegate {
  setSize(prev: number, next: number): void;
  setAbsoluteSize(size: number, isLatter?: boolean): void;
}

function preventWebviewCatchMouseEvents() {
  const iframes = document.getElementsByTagName('iframe');
  const webviews = document.getElementsByTagName('webviews');
  for (const webview of webviews as any) {
    webview.classList.add('none-pointer-event');
  }
  for (const iframe of iframes as any) {
    iframe.classList.add('none-pointer-event');
  }
}

function allowWebviewCatchMouseEvents() {
  const iframes = document.getElementsByTagName('iframe');
  const webviews = document.getElementsByTagName('webviews');
  for (const webview of webviews  as any) {
    webview.classList.remove('none-pointer-event');
  }
  for (const iframe of iframes  as any) {
    iframe.classList.remove('none-pointer-event');
  }
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

  const setSize = (prev: number, next: number) => {
    nextElement.current!.style.width = next * 100 + '%';
    prevElement.current!.style.width = prev * 100 + '%';
    if (props.onResize) {
      props.onResize();
    }
  };

  const setAbsoluteSize = (size: number, isLatter?: boolean) => {
    const currentPrev = prevElement.current!.clientWidth;
    const currentNext = nextElement.current!.clientWidth;
    const totalSize = currentPrev + currentNext;
    const currentTotalWidth = +nextElement.current!.style.width!.replace('%', '') + +prevElement.current!.style.width!.replace('%', '');
    if (isLatter) {
      nextElement.current!.style.width = currentTotalWidth * (size / totalSize) + '%';
      prevElement.current!.style.width = currentTotalWidth * (1 - size / totalSize) + '%';
    } else {
      prevElement.current!.style.width = currentTotalWidth * (size / totalSize) + '%';
      nextElement.current!.style.width = currentTotalWidth * (1 - size / totalSize) + '%';
    }
    if (props.onResize) {
      props.onResize();
    }
  };

  const onMouseMove =  ((e) => {
    const prevWidth = startPrevWidth.current + e.pageX - startX.current;
    const nextWidth = startNextWidth.current - ( e.pageX - startX.current);
    const preserve = props.preserve || 0;
    if (requestFrame.current) {
      window.cancelAnimationFrame(requestFrame.current);
    }
    const parentWidth = ref.current!.parentElement!.offsetWidth;
    requestFrame.current = window.requestAnimationFrame(() => {
     setSize( (prevWidth / parentWidth), (nextWidth / parentWidth));
    });

  });
  const onMouseUp = ((e) => {
    resizing.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    if (props.onFinished) {
      props.onFinished();
    }
    allowWebviewCatchMouseEvents();
  });
  const onMouseDown =  ((e) => {
    resizing.current = true;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    startX.current = e.pageX;
    startPrevWidth.current = prevElement.current!.offsetWidth;
    startNextWidth.current = nextElement.current!.offsetWidth;
    preventWebviewCatchMouseEvents();
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

  if (props.delegate) {
    props.delegate({
      setSize,
      setAbsoluteSize,
    });
  }

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

  const setSize = (prev: number, next: number) => {
      nextElement.current!.style.height = next * 100 + '%';
      prevElement.current!.style.height = prev * 100 + '%';
      if (props.onResize) {
        props.onResize();
      }
  };

  const setAbsoluteSize = (size: number, isLatter?: boolean) => {
    const currentPrev = prevElement.current!.clientWidth;
    const currentNext = nextElement.current!.clientWidth;
    const totalSize = currentPrev + currentNext;
    const currentTotalWidth = +nextElement.current!.style.width!.replace('%', '') + +prevElement.current!.style.width!.replace('%', '');
    if (isLatter) {
      nextElement.current!.style.width = currentTotalWidth * (size / totalSize) + '%';
      prevElement.current!.style.width = currentTotalWidth * (1 - size / totalSize) + '%';
    } else {
      prevElement.current!.style.width = currentTotalWidth * (size / totalSize) + '%';
      nextElement.current!.style.width = currentTotalWidth * (1 - size / totalSize) + '%';
    }
    if (props.onResize) {
      props.onResize();
    }
  };

  const onMouseDown = ((e) => {
    resizing.current = true;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    startY.current = e.pageY;
    startPrevHeight.current = prevElement.current!.offsetHeight;
    startNextHeight.current = nextElement.current!.offsetHeight;
    preventWebviewCatchMouseEvents();
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
      setSize((prevHeight / parentHeight), (nextHeight / parentHeight));
    });
  });

  const onMouseUp = ((e) => {
    resizing.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    if (props.onFinished) {
      props.onFinished();
    }
    allowWebviewCatchMouseEvents();
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

  if (props.delegate) {
    props.delegate({
      setSize,
      setAbsoluteSize,
    });
  }

  return (<div ref={(e) => e && (ref.current = e) } className={classnames({
    [styles['resize-handle-vertical']]: true,
    [props.className || '']: true,
  })}/>);

};
