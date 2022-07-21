import cxs from 'classnames';
import React from 'react';
import { useEffect, useState, useRef } from 'react';

import './style.less';

export const Tooltip: React.FC<{
  title: string;
  delay?: number;
  children?: React.ReactNode;
}> = ({ title, children, delay }) => {
  const [visible, setVisible] = useState(false);
  const targetRef = useRef<HTMLParagraphElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const arrowRef = useRef<HTMLSpanElement | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function handleMouseEnter() {
    if (visible) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      return;
    }
    timerRef.current = setTimeout(() => {
      setVisible(true);
      if (tooltipRef.current && targetRef.current && arrowRef.current) {
        const { x, y, width, height } = targetRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        if (y < tooltipRect.height * 1.5) {
          arrowRef.current.className += ' kt-tooltip-reverse-arrow';
          tooltipRef.current.style.top = `${y + height + tooltipRect.height / 2}px`;
        } else {
          tooltipRef.current.style.top = `${y - tooltipRect.height * 1.5}px`;
        }
        if (x + tooltipRect.width / 2 >= document.body.offsetWidth) {
          arrowRef.current.style.right = `${width / 2 - 7}px`;
          tooltipRef.current.style.left = `${x + width - tooltipRect.width}px`;
        } else if (x - tooltipRect.width / 2 <= 0) {
          arrowRef.current.style.left = `${width / 2 - 7}px`;
          tooltipRef.current.style.left = `${x}px`;
        } else {
          arrowRef.current.style.left = `${tooltipRect.width / 2 - 7}px`;
          tooltipRef.current.style.left = `${x + width / 2 - tooltipRect.width / 2}px`;
        }
      }
      clearTimeout(timerRef.current);
    }, delay || 500);
  }

  function handleMouseLeave() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
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
