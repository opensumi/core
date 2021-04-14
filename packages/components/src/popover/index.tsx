import * as React from 'react';
import clx from 'classnames';

import './styles.less';
import { Button } from '../button';

// 目前支持支持 hover，后面按需拓展
export enum PopoverTriggerType {
  hover,
  program, // 只遵守外层传入的display
}

export enum PopoverPosition {
  top = 'top',
  bottom = 'bottom',
  left = 'left',
  right = 'right',
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
  const childEl = React.useRef<HTMLSpanElement | null>(null);
  const contentEl = React.useRef<HTMLDivElement | null>(null);
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
      const { left, top, width, height } = childEl.current.getBoundingClientRect() as ClientRect;
      const contentRect = contentEl.current.getBoundingClientRect() as ClientRect;

      if (position === PopoverPosition.top) {
        const contentLeft = left - contentRect.width / 2 + width / 2;
        const contentTop = top - contentRect.height - 7;
        contentEl.current.style.left = (contentLeft < 0 ? 0 : contentLeft) +  'px';
        contentEl.current.style.top = (contentTop < 0 ? 0 : contentTop) + 'px';
        contentEl.current.style.visibility = 'visible';
      } else if (position === PopoverPosition.bottom) {
        const contentLeft = left - contentRect.width / 2 + width / 2;
        const contentTop = top + height + 7;
        contentEl.current.style.left = (contentLeft < 0 ? 0 : contentLeft) +  'px';
        contentEl.current!.style.top = (contentTop < 0 ? 0 : contentTop) + 'px';
        contentEl.current.style.visibility = 'visible';
      } else if (position === PopoverPosition.left) {
        const contentLeft = left - contentRect.width - 7;
        const contentTop = top - contentRect.height / 2 + height / 2;
        contentEl.current.style.left = (contentLeft < 0 ? 0 : contentLeft) +  'px';
        contentEl.current.style.top = (contentTop < 0 ? 0 : contentTop) + 'px';
        contentEl.current.style.visibility = 'visible';
      } else if (position === PopoverPosition.right) {
        const contentLeft = left + width + 7;
        const contentTop = top - contentRect.height / 2 + height / 2;
        contentEl.current.style.left = (contentLeft < 0 ? 0 : contentLeft) +  'px';
        contentEl.current.style.top = (contentTop < 0 ? 0 : contentTop) + 'px';
        contentEl.current.style.visibility = 'visible';
      }
    });
  }

  function hideContent() {
    if (!contentEl.current) {
      return;
    }
    hideContentTimer = setTimeout(() => {
      contentEl.current!.style.display = 'none';
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
      className={clx('kt-popover', insertClass)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className={clx(popoverClass || '', 'kt-popover-content', `kt-popover-${position}`)}
        ref={contentEl}
        id={id}
        >
        {title && <p className={clx('kt-popover-title', titleClassName)}>
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
