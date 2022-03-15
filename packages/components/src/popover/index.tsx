import clx from 'classnames';
import React from 'react';

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
  content?: React.ReactNode;
  trigger?: PopoverTriggerType;
  display?: boolean; // 使用程序控制的是否显示
  [key: string]: any;
  popoverClass?: string;
  position?: PopoverPosition;
  delay?: number;
  title?: string;
  titleClassName?: string;
  action?: string;
  disable?: boolean;
  onClickAction?: (args: any) => void;
}> = ({
  delay,
  children,
  trigger,
  display,
  id,
  insertClass,
  popoverClass,
  content,
  position = PopoverPosition.top,
  title,
  titleClassName,
  action,
  onClickAction,
  disable,
  ...restProps
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

  function resizeContent() {
    if (!contentEl.current || !childEl.current || disable) {
      return;
    }
    const { left, top, width, height } = childEl.current.getBoundingClientRect() as ClientRect;
    const contentRect = contentEl.current.getBoundingClientRect() as ClientRect;
    if (position === PopoverPosition.top) {
      const contentLeft =
        contentRect.right - window.innerWidth > 0
          ? window.innerWidth - contentRect.width
          : left - contentRect.width / 2 + width / 2;
      const contentTop = top - contentRect.height - 7;
      contentEl.current.style.left = (contentLeft < 0 ? 0 : contentLeft) + 'px';
      contentEl.current.style.top = (contentTop < 0 ? 0 : contentTop) + 'px';
      contentEl.current.style.visibility = 'visible';
    } else if (position === PopoverPosition.bottom) {
      const contentLeft =
        contentRect.right - window.innerWidth > 0
          ? window.innerWidth - contentRect.width
          : left - contentRect.width / 2 + width / 2;
      const contentTop = top + height + 7;
      contentEl.current.style.left = (contentLeft < 0 ? 0 : contentLeft) + 'px';
      contentEl.current.style.top = (contentTop < 0 ? 0 : contentTop) + 'px';
      contentEl.current.style.visibility = 'visible';
    } else if (position === PopoverPosition.left) {
      const contentLeft = left - contentRect.width - 7;
      const contentTop = top - contentRect.height / 2 + height / 2;
      contentEl.current.style.left = (contentLeft < 0 ? 0 : contentLeft) + 'px';
      contentEl.current.style.top = (contentTop < 0 ? 0 : contentTop) + 'px';
      contentEl.current.style.visibility = 'visible';
    } else if (position === PopoverPosition.right) {
      const contentLeft = left + width + 7;
      const contentTop = top - contentRect.height / 2 + height / 2;
      contentEl.current.style.left = (contentLeft < 0 ? 0 : contentLeft) + 'px';
      contentEl.current.style.top = (contentTop < 0 ? 0 : contentTop) + 'px';
      contentEl.current.style.visibility = 'visible';
    }
  }

  function showContent() {
    if (!contentEl.current || !childEl.current || disable) {
      return;
    }
    clearTimeout(hideContentTimer);
    contentEl.current.style.display = 'block';
    window.requestAnimationFrame(() => {
      if (!childEl.current || !contentEl.current) {
        return;
      }
      resizeContent();
      // 因为 content 是挂在到 Body 上的，第一次渲染后，无法判断是否到达了右边界，需要再加一个补偿逻辑
      window.requestAnimationFrame(() => {
        resizeContent();
        contentEl.current!.style.visibility = 'visible';
      });
    });
  }

  function hideContent() {
    if (!contentEl.current) {
      return;
    }
    hideContentTimer = setTimeout(() => {
      contentEl.current!.style.display = 'none';
      contentEl.current!.style.visibility = 'hidden';
    }, delay);
  }

  React.useEffect(() => {
    if (!contentEl.current) {
      return;
    }
    const oldEl = document.body.querySelector(`body > #${CSS.escape(id)}`);
    if (oldEl) {
      document.body.removeChild(oldEl);
    }
    contentEl.current.style.display = 'none';
    document.body.appendChild(contentEl.current);
    if (display) {
      showContent();
    }
    return () => {
      const oldEl = document.body.querySelector(`body > #${CSS.escape(id)}`);
      if (oldEl) {
        document.body.removeChild(oldEl);
      }
    };
  }, [display]);

  return (
    <div
      {...Object.assign({}, restProps)}
      className={clx('kt-popover', insertClass)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={clx(popoverClass || '', 'kt-popover-content', `kt-popover-${position}`)} ref={contentEl} id={id}>
        {title && (
          <p className={clx('kt-popover-title', titleClassName)}>
            {title}
            {action && (
              <Button size='small' type='link' onClick={onClickAction || noop}>
                {action}
              </Button>
            )}
          </p>
        )}
        {content || ''}
      </div>
      <span ref={childEl}>{children}</span>
    </div>
  );
};
