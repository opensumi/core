import * as React from 'react';
import clx from 'classnames';

import * as styles from './styles.module.less';

// 目前支持支持 hover，后面按需拓展
export enum PopoverTriggerType {
  hover,
}

export const Popover: React.FC<{
  id: string;
  insertClass?: string;
  content?: React.ReactElement;
  trigger?: PopoverTriggerType;
  [key: string]: any;
}> = ({ children, trigger, id, insertClass, content, ...restProps }) => {
  const childEl = React.useRef<any>();
  const contentEl = React.useRef<any>();
  const type = trigger || PopoverTriggerType.hover;

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
    const { left, top, width, height } = (childEl.current as any).getBoundingClientRect() as ClientRect;
    const contentRect = (contentEl.current as any).getBoundingClientRect() as ClientRect;

    const contentLeft = left - contentRect.width / 2 + width / 2;
    const contentTop = top - contentRect.height;
    (contentEl.current! as HTMLElement).style.left = (contentLeft < 0 ? 0 : contentLeft) +  'px';
    contentEl.current!.style.top = (contentTop < 0 ? 0 : contentTop) + 'px';
    contentEl.current.style.display = 'block';
  }

  function hideContent() {
    if (!contentEl.current) {
      return;
    }
    contentEl.current.style.display = 'none';
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
  }, []);

  return(
    <span {...Object.assign({}, restProps)} className={clx(styles.popover, insertClass)} >
      <span className={clx(styles.content)} ref={contentEl} id={id}>
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
