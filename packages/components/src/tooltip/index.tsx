import cxs from 'classnames';
import React from 'react';
import { useState, useRef } from 'react';

import './style.less';

export const Tooltip: React.FC<{
  title: string;
  delay?: number;
}> = ({ title, children, delay }) => {
  const [visible, setVisible] = useState(false);
  const targetRef = useRef<HTMLParagraphElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const arrowRef = useRef<HTMLSpanElement | null>(null);
  let timer;

  function handleMouseEnter() {
    if (visible) {
      if (timer) {
        clearTimeout(timer);
      }
      return;
    }
    timer = setTimeout(() => {
      setVisible(true);
      if (tooltipRef.current && targetRef.current && arrowRef.current) {
        const { x, y, width, height } = targetRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();

        if (y < tooltipRect.height) {
          arrowRef.current.className += ' kt-tooltip-reverse-arrow';
          tooltipRef.current.style.top = `${y + height + tooltipRect.height / 2}px`;
        } else {
          tooltipRef.current.style.top = `${y - height / 2 - tooltipRect.height / 2}px`;
        }

        if (x + tooltipRect.width >= document.body.offsetWidth) {
          arrowRef.current.style.left = `${x + tooltipRect.width - document.body.offsetWidth + width / 2}px`;
          tooltipRef.current.style.left = `${document.body.offsetWidth - tooltipRect.width}px`;
        } else {
          tooltipRef.current.style.left = `${x + width / 2 - tooltipRect.width / 2}px`;
        }
      }
      clearTimeout(timer);
    }, delay || 500);
  }

  function handleMouseLeave() {
    if (timer) {
      clearTimeout(timer);
    }
    setVisible(false);
  }

  return (
    <p ref={targetRef} className={'kt-tooltip-wrapper'} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {visible && (
        <span ref={tooltipRef} className={cxs('kt-tooltip-content')}>
          {title}
          <span ref={arrowRef} className={'kt-tooltip-arrow-placeholder'} />
        </span>
      )}
    </p>
  );
};
