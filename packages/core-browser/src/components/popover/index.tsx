import * as React from 'react';
import clx from 'classnames';

import * as styles from './styles.module.less';

// 目前支持支持 hover，后面按需拓展
export enum PopoverTriggerType {
  hover,
  program, // 只遵守外层传入的display
}

export enum PopoverPosition {
  top = 'top',
  bottom = 'bottom',
}

export const Popover: React.FC<{
  id: string;
  insertClass?: string;
  content?: React.ReactElement;
  trigger?: PopoverTriggerType;
  display?: boolean, // 使用程序控制的是否显示
  [key: string]: any;
  popoverClass?: string;
  position?: PopoverPosition;
}> = ({ children, trigger, display, id, insertClass, popoverClass, content, position = PopoverPosition.top , ...restProps}) => {
  const childEl = React.useRef<any>();
  const contentEl = React.useRef<any>();
  const type = trigger || PopoverTriggerType.hover;
  let hideContentTimer;

  function onMouseEnter() {
    if (type === PopoverTriggerType.hover) {
      showContent();
    }
  }

  function onMouseLeave() {
    if (type === PopoverTriggerType.hover) {
      hideContent();
    }
  }

  function showContent() {
    if (!contentEl.current || !childEl.current) {
      return;
    }
    clearTimeout(hideContentTimer);
    contentEl.current.style.display = 'block';
    contentEl.current.style.visibility = 'hidden';
    setTimeout(() => {
      if (position === PopoverPosition.top) {
        const { left, top, width } = (childEl.current as any).getBoundingClientRect() as ClientRect;
        const contentRect = (contentEl.current as any).getBoundingClientRect() as ClientRect;
        const contentLeft = left - contentRect.width / 2 + width / 2;
        const contentTop = top - contentRect.height;
        (contentEl.current! as HTMLElement).style.left = (contentLeft < 0 ? 0 : contentLeft) +  'px';
        contentEl.current!.style.top = (contentTop < 0 ? 0 : contentTop) + 'px';
        contentEl.current.style.visibility = 'visible';
      } else if (position === PopoverPosition.bottom) {
        const { left, top, width, height } = (childEl.current as any).getBoundingClientRect() as ClientRect;
        const contentRect = (contentEl.current as any).getBoundingClientRect() as ClientRect;
        const contentLeft = left - contentRect.width / 2 + width / 2;
        const contentTop = top + height + 7;
        (contentEl.current! as HTMLElement).style.left = (contentLeft < 0 ? 0 : contentLeft) +  'px';
        contentEl.current!.style.top = (contentTop < 0 ? 0 : contentTop) + 'px';
        contentEl.current.style.visibility = 'visible';
      }
    });
  }

  function hideContent() {
    if (!contentEl.current) {
      return;
    }
    hideContentTimer = setTimeout(() => {
      contentEl.current.style.display = 'none';
    }, 200);
  }

  React.useEffect(() => {
    if (!contentEl.current) {
      return;
    }
    const oldEl = document.body.querySelector(`body > #${id}`);
    if (oldEl) {
      document.body.removeChild(oldEl);
    }
    contentEl.current.style.display = 'none';
    document.body.appendChild(contentEl.current);
    if (display) {
      showContent();
    }
    return () => {
      const oldEl = document.body.querySelector(`body > #${id}`);
      if (oldEl) {
        document.body.removeChild(oldEl);
      }
    };
  }, []);

  return(
    <span {...Object.assign({}, restProps)} className={clx(styles.popover, insertClass)} >
      <span
        className={clx(popoverClass || '', styles.content, styles[position])}
        ref={contentEl}
        id={id}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {content || ''}
      </span>
      <span
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        ref={childEl}
      >
        {children}
      </span>
    </span>
  );
};
