import * as React from 'react';
import * as styles from './resize.module.less';
import classnames from 'classnames';

export const RESIZE_LOCK = 'resize-lock';

export interface ResizeHandleProps {
  onFinished?: () => void;
  onResize?: (prevElement: HTMLElement, nextElement: HTMLElement) => void;
  max?: number;
  min?: number;
  preserve?: number; // percentage
  className?: string;
  noColor?: boolean;
  delegate?: (delegate: IResizeHandleDelegate) => void;
  findPrevElement?: (direction?: boolean) => HTMLElement | undefined;
  findNextElement?: (direction?: boolean) => HTMLElement | undefined;
}

export interface IResizeHandleDelegate {
  setSize(prev: number, next: number): void;
  setRelativeSize(prev: number, next: number): void;
  getRelativeSize(): number[];
  setAbsoluteSize(size: number, isLatter?: boolean, keep?: boolean): void;
  getAbsoluteSize(isLatter?: boolean): number;
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
    const parentWidth = ref.current!.parentElement!.offsetWidth;
    const prevEle = props.findPrevElement ? props.findPrevElement() : prevElement.current!;
    const nextEle = props.findNextElement ? props.findNextElement() : nextElement.current!;
    if (
      (prevEle && prevEle.classList.contains(RESIZE_LOCK)) || (nextEle && nextEle.classList.contains(RESIZE_LOCK))
    ) {
      return;
    }
    const prevMinResize = prevEle!.dataset.minResize || 0;
    const nextMinResize = nextEle!.dataset.minResize || 0;
    if (prevMinResize || nextMinResize) {
      if (prev * parentWidth <= prevMinResize || next * parentWidth <= nextMinResize) {
        return;
      }
    }
    if (nextEle) {
      nextEle.style.width = next * 100 + '%';
    }
    if (prevEle) {
      prevEle.style.width = prev * 100 + '%';
    }
    if (props.onResize && nextEle && prevEle) {
      props.onResize(prevEle, nextEle);
    }
  };

  const setRelativeSize = (prev: number, next: number) => {
    const prevEle = prevElement.current!;
    const nextEle = nextElement.current!;
    const currentTotalWidth = +nextElement.current!.style.width!.replace('%', '') + +prevElement.current!.style.width!.replace('%', '');
    if (nextEle) {
      nextEle.style.width = next / (prev + next) * currentTotalWidth + '%';
    }
    if (prevEle) {
      prevEle.style.width = prev / (prev + next) * currentTotalWidth + '%';
    }
    handleZeroSize();

    if (props.onResize && nextEle && prevEle) {
      props.onResize(prevEle, nextEle);
    }
  };

  const getRelativeSize = () => {
    const currentPrev = prevElement.current!.clientWidth;
    const currentNext = nextElement.current!.clientWidth;
    const totalSize = currentPrev + currentNext;
    const relativeSizes: number[] = [];
    relativeSizes.push(currentPrev / totalSize);
    relativeSizes.push(currentNext / totalSize);
    return relativeSizes;
  };

  /**
   * 处理存在置0的情况
   */
  const handleZeroSize = () => {
    // 对于设置为0的情况，一般认为是会需要完全隐藏对应元素，并且当前handle变为不可用
    const prevEle = prevElement.current!;
    const nextEle = nextElement.current!;
    let hasZero = false;
    if (prevEle) {
      if (parseFloat(prevEle.style.width) === 0) {
        prevEle.classList.add('kt_display_none');
        hasZero = true;
      } else {
        prevEle.classList.remove('kt_display_none');
      }
    }
    if (nextEle) {
      if (parseFloat(nextEle.style.width) === 0) {
        nextEle.classList.add('kt_display_none');
        hasZero = true;
      } else {
        nextEle.classList.remove('kt_display_none');
      }
    }
    if (ref.current) {
      if (hasZero) {
        ref.current.classList.add('none-pointer-event');
      } else {
        ref.current.classList.remove('none-pointer-event');
      }
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
    handleZeroSize();
    if (props.onResize) {
      props.onResize(prevElement.current!, nextElement.current!);
    }
  };

  const getAbsoluteSize = (isLatter?: boolean) => {
    if (isLatter) {
      return nextElement.current!.clientWidth;
    }
    return prevElement.current!.clientWidth;
  };

  const onMouseMove =  ((e) => {
    e.preventDefault();
    if (ref.current && ref.current.classList.contains('no-resize')) {
      return;
    }
    const prevWidth = startPrevWidth.current + e.pageX - startX.current;
    const nextWidth = startNextWidth.current - ( e.pageX - startX.current);
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
      getAbsoluteSize,
      setRelativeSize,
      getRelativeSize,
    });
  }

  return (
    <div ref={(e) => {ref.current = e; } } className={classnames({
      [styles['resize-handle-horizontal']]: true,
      [styles['with-color']]: !props.noColor,
      [props.className || '']: true,
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

  const cachedPrevElement = React.useRef<HTMLElement>();
  const cachedNextElement = React.useRef<HTMLElement>();

  const requestFrame = React.useRef<number>();
  // direction: true为向下，false为向上
  const setSize = (prev: number, next: number, direction?: boolean) => {
      const prevEle = props.findPrevElement ? props.findPrevElement(direction) : prevElement.current!;
      const nextEle = props.findNextElement ? props.findNextElement(direction) : nextElement.current!;
      if (!nextEle || !prevEle) {
        return;
      }
      if (prevEle.classList.contains(RESIZE_LOCK) || nextEle.classList.contains(RESIZE_LOCK)) {
        return;
      }
      nextEle.style.height = next * 100 + '%';
      prevEle.style.height = prev * 100 + '%';
      if (props.onResize) {
        props.onResize(prevEle, nextEle);
      }
  };

  const setRelativeSize = (prev: number, next: number) => {
    const prevEle = prevElement.current!;
    const nextEle = nextElement.current!;
    const currentTotalHeight = +nextEle.style.height!.replace('%', '') + +prevEle.style.height!.replace('%', '');
    if (nextEle) {
      nextEle.style.height = next / (prev + next) * currentTotalHeight + '%';
    }
    if (prevEle) {
      prevEle.style.height = prev / (prev + next) * currentTotalHeight + '%';
    }
    handleZeroSize();
    if (props.onResize && nextEle && prevEle) {
      props.onResize(prevEle, nextEle);
    }
  };

  /**
   * 处理存在置0的情况
   */
  const handleZeroSize = () => {
    // 对于设置为0的情况，一般认为是会需要完全隐藏对应元素，并且当前handle变为不可用
    const prevEle = prevElement.current!;
    const nextEle = nextElement.current!;
    let hasZero = false;
    if (prevEle) {
      if (parseFloat(prevEle.style.height) === 0) {
        prevEle.classList.add('kt_display_none');
        hasZero = true;
      } else {
        prevEle.classList.remove('kt_display_none');
      }
    }
    if (nextEle) {
      if (parseFloat(nextEle.style.height) === 0) {
        nextEle.classList.add('kt_display_none');
        hasZero = true;
      } else {
        nextEle.classList.remove('kt_display_none');
      }
    }
    if (ref.current) {
      if (hasZero) {
        ref.current.classList.add('none-pointer-event');
      } else {
        ref.current.classList.remove('none-pointer-event');
      }
    }
  };

  const getRelativeSize = () => {
    const currentPrev = prevElement.current!.clientHeight;
    const currentNext = nextElement.current!.clientHeight;
    const totalSize = currentPrev + currentNext;
    const relativeSizes: number[] = [];
    relativeSizes.push(currentPrev / totalSize);
    relativeSizes.push(currentNext / totalSize);
    return relativeSizes;
  };

  const setDomSize = (prev: number, next: number, prevEle: HTMLElement, nextEle: HTMLElement) => {
    if (prevEle.classList.contains(RESIZE_LOCK) || nextEle.classList.contains(RESIZE_LOCK)) {
      return;
    }
    nextEle.style.height = next * 100 + '%';
    prevEle.style.height = prev * 100 + '%';
    if (props.onResize && nextEle && prevEle) {
      props.onResize(prevEle, nextEle);
    }
  };

  // keep = true 左右侧面板使用，保证相邻节点的总宽度不变
  const setAbsoluteSize = (size: number, isLatter?: boolean, keep?: boolean) => {
    const currentPrev = prevElement.current!.clientHeight;
    const currentNext = nextElement.current!.clientHeight;
    const totalSize = currentPrev + currentNext;
    const nextH = +nextElement.current!.style.height!.replace(/\%|px/, '');
    const prevH = +prevElement.current!.style.height!.replace(/\%|px/, '');
    const currentTotalHeight = nextH + prevH;
    if (isLatter) {
      if (keep) {
        prevElement.current!.style.height = currentTotalHeight * (1 - size / totalSize) + '%';
      }
      const targetSize = currentTotalHeight * (size / totalSize);
      nextElement.current!.style.height = targetSize === 0 ? targetSize + 'px' : targetSize + '%';
    } else {
      prevElement.current!.style.height = currentTotalHeight * (size / totalSize) + '%';
      if (keep) {
        nextElement.current!.style.height = currentTotalHeight * (1 - size / totalSize) + '%';
      }
    }
    // 使用setTimeout，因为要到下一个eventLoop才会重新计算高度
    handleZeroSize();
    if (props.onResize) {
      props.onResize(prevElement.current!, nextElement.current!);
    }
  };

  const getAbsoluteSize = (isLatter?: boolean) => {
    if (isLatter) {
      return nextElement.current!.clientHeight;
    }
    return prevElement.current!.clientHeight;
  };

  const onMouseDown = ((e) => {
    resizing.current = true;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    startY.current = e.pageY;
    cachedNextElement.current = nextElement.current;
    cachedPrevElement.current = prevElement.current;
    startPrevHeight.current = prevElement.current!.offsetHeight;
    startNextHeight.current = nextElement.current!.offsetHeight;
    preventWebviewCatchMouseEvents();
  });

  const onMouseMove = ((e: MouseEvent) => {
    e.preventDefault();
    if (ref.current && ref.current.classList.contains('no-resize')) {
      return;
    }
    const direction = e.pageY > startY.current;
    // 若上层未传入findNextElement，dynamicNext为null，否则找不到符合要求的panel时返回undefined
    const dynamicNext = props.findNextElement ? props.findNextElement(direction) : null;
    const dynamicPrev = props.findPrevElement ? props.findPrevElement(direction) : null;
    // 作用元素变化重新初始化当前位置，传入findNextElement时默认已传入findPrevElement
    if (
      (dynamicNext !== null && cachedNextElement.current !== dynamicNext) ||
        (dynamicPrev !== null && cachedPrevElement.current !== dynamicPrev)
    ) {
      if (!dynamicNext || !dynamicPrev) {
        return;
      }
      cachedNextElement.current = dynamicNext!;
      cachedPrevElement.current = dynamicPrev!;
      startY.current = e.pageY;
      startPrevHeight.current = cachedPrevElement.current!.offsetHeight;
      startNextHeight.current = cachedNextElement.current!.offsetHeight;
    }

    const prevHeight = startPrevHeight.current + e.pageY - startY.current;
    const nextHeight = startNextHeight.current - ( e.pageY - startY.current);
    if (requestFrame.current) {
      window.cancelAnimationFrame(requestFrame.current);
    }
    const parentHeight = ref.current!.parentElement!.offsetHeight;
    requestFrame.current = window.requestAnimationFrame(() => {
      const prevMinResize = cachedPrevElement.current!.dataset.minResize || 0;
      const nextMinResize = cachedNextElement.current!.dataset.minResize || 0;
      if (prevMinResize || nextMinResize) {
        if (prevHeight <= prevMinResize || nextHeight <= nextMinResize) {
          return;
        }
      }
      setDomSize(prevHeight / parentHeight, nextHeight / parentHeight, cachedPrevElement.current!, cachedNextElement.current!);
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
      getAbsoluteSize,
      setRelativeSize,
      getRelativeSize,
    });
  }

  return (<div ref={(e) => e && (ref.current = e) } className={classnames({
    [styles['resize-handle-vertical']]: true,
    [props.className || '']: true,
    [styles['with-color']]: !props.noColor,
  })}/>);

};
