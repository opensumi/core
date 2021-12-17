import React from 'react';

export const ClickOutside: React.FC<
  {
    onOutsideClick: (e: MouseEvent) => void;
    // 目前仅处理 click 和 context menu
    mouseEvents?: ['click'] | ['contextmenu'] | ['click', 'contextmenu'];
  } & React.HTMLAttributes<HTMLDivElement>
> = ({ mouseEvents = ['click'], onOutsideClick, children, ...restProps }) => {
  const $containerEl = React.useRef<HTMLDivElement | null>(null);

  const globalClickSpy = React.useCallback(
    (e: MouseEvent) => {
      if ($containerEl.current && e.target && !$containerEl.current.contains(e.target as any)) {
        onOutsideClick(e);
      }
    },
    [onOutsideClick],
  );

  React.useEffect(() => {
    mouseEvents.forEach((event) => {
      window.addEventListener(event, globalClickSpy, true);
    });
    return () => {
      mouseEvents.forEach((event) => {
        window.removeEventListener(event, globalClickSpy, true);
      });
    };
  }, [mouseEvents]);

  return (
    <div {...restProps} ref={$containerEl}>
      {children}
    </div>
  );
};
