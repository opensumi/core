import * as React from 'react';
import clx from 'classnames';

import * as styles from './styles.module.less';
import { Button } from '../button';

// 目前支持支持 hover，后面按需拓展
export enum PopoverTriggerType {
  hover,
  program, // 只遵守外层传入的display
}

export enum PopoverPosition {
  top = 'top',
  bottom = 'bottom',
}

function noop() {}

export const Popover: React.FC<{
  id: string;
  insertClass?: string;
  content?: React.ReactElement;
  trigger?: PopoverTriggerType;
  display?: boolean, // 使用程序控制的是否显示
  [key: string]: any;
  popoverClass?: string;
  position?: PopoverPosition;
  delay?: number;
  title?: string;
  titleClassName?: string;
  action?: string;
  onClickAction?: (args: any) => void;
}> = ({
  delay, children, trigger, display, id, insertClass, popoverClass, content, position = PopoverPosition.top, title, titleClassName, action, onClickAction, ...restProps
}) => {
  const childEl = React.useRef<any>();
  const contentEl = React.useRef<any>();
  const triggerType = trigger || PopoverTriggerType.hover;
  let hideContentTimer;
  let actionDelayTimer;

  function onMouseEnter() {
    if (triggerType === PopoverTriggerType.hover) {
      if (delay) {
        actionDelayTimer = setTimeout(() => {
          showContent();
        }, delay);
      } else {
        showContent();
      }
    }
  }

  function onMouseLeave() {
    if (triggerType === PopoverTriggerType.hover) {
      clearTimeout(actionDelayTimer);
      hideContent();
    }
  }

  function showContent() {
    if (!contentEl.current || !childEl.current) {
      return;
    }
    clearTimeout(hideContentTimer);
    contentEl.current.style.display = 'block';
    setTimeout(() => {
      if (!childEl.current || !contentEl.current) {
        return;
      }
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
    }, 500);
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
  }, [display]);

  return(
    <div
      {...Object.assign({}, restProps)}
      className={clx(styles.popover, insertClass)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className={clx(popoverClass || '', styles.content, position)}
        ref={contentEl}
        id={id}
        >
        {title && <p className={clx(styles.title, titleClassName)}>
          {title}
          {action && <Button size='small' type='link' onClick={onClickAction || noop}>{action}</Button>}
        </p>}
        {content || ''}
      </div>
      <span ref={childEl}>
        {children}
      </span>
    </div>
  );
};
