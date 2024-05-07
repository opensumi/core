import React, { RefObject, useEffect, useRef } from 'react';

import type { MaybePromise } from '@opensumi/ide-utils';

import './styles.less';

export interface IOpenerShape {
  open(uri: string): MaybePromise<boolean>;
}

export const DATA_SET_COMMAND = 'data-command';

export const RenderWrapper = (props: { html: string; opener?: IOpenerShape }) => {
  const ref = useRef<HTMLDivElement | undefined>();
  const { html, opener } = props;

  useEffect(() => {
    if (ref && ref.current) {
      ref.current.addEventListener('click', listenClick);
    }
    return () => {
      if (ref && ref.current) {
        ref.current.removeEventListener('click', listenClick);
      }
    };
  }, []);

  /**
   * 拦截 a 标签的点击事件，触发 commands
   */
  const listenClick = (event: PointerEvent) => {
    let target = event.target as HTMLElement;
    if (target.className.includes('codicon')) {
      target = target.parentNode as HTMLElement;
    }
    if (target.tagName.toLowerCase() === 'a' && target.hasAttribute(DATA_SET_COMMAND)) {
      const dataCommand = target.getAttribute(DATA_SET_COMMAND);
      if (dataCommand && opener) {
        opener.open(dataCommand);
      }
    }
  };

  return (
    <div
      className='kt-md-renderer-wrap'
      dangerouslySetInnerHTML={{ __html: html }}
      ref={ref as unknown as RefObject<HTMLDivElement>}
    ></div>
  );
};
